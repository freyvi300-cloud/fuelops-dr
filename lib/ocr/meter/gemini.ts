/**
 * FuelOps-DR — Gemini Vision Meter OCR Provider
 *
 * JSON reliability strategy (three layers):
 *
 *   Layer 1 — Structured output: responseSchema forces Gemini to output JSON
 *             matching the schema exactly. No fences, no preamble, no truncation.
 *
 *   Layer 2 — Robust parser: if Gemini somehow returns markdown or prose,
 *             parseGeminiJSON() strips fences, extracts the first {...} block,
 *             and attempts repairTruncatedJSON() before giving up.
 *
 *   Layer 3 — ModelResponseError: if parsing fails completely, throws
 *             ModelResponseError (not a generic Error). commands.ts catches
 *             it and replies "⚠️ Ocurrió un error interno..." — never
 *             "No pude leer el medidor" for a parse-level failure.
 *
 * Digit accuracy strategy:
 *   Gemini returns digits[] + decimal_position instead of a final number.
 *   Application code assembles the value — eliminating the model's tendency
 *   to "collapse" leading zeros (0100.0 → 10.0) when inferring the total.
 *   If the assembled result fails consistency checks, one strict retry fires.
 *
 * Rate-limit handling: exponential backoff (2 s → 4 s), max 3 attempts.
 */

import type {
  MeterOCRProviderOptimized,
  DetectionStage,
  ReadingStage,
} from "./types"
import { RateLimitError, ModelResponseError } from "./types"

// ─── Retry / token config ─────────────────────────────────────────────────────

const MAX_ATTEMPTS      = 3
const BACKOFF_MS        = [2000, 4000]

// maxOutputTokens: 1024 is well above the ~200 tokens a digits-array response needs.
// thinkingBudget: 0 disables Gemini 2.5 Flash internal reasoning, preserving
// all output tokens for the actual JSON.
const MAX_OUTPUT_TOKENS  = 1024
const THINKING_BUDGET    = 0

// Fuel meters always have at least 4 wheels (integer + decimal).
// If Gemini returns fewer digits, the reading was collapsed — trigger retry.
const MIN_WHEEL_COUNT = 4

// ─── Digit assembly ───────────────────────────────────────────────────────────

/**
 * Build the numeric value from the wheel-by-wheel digit array.
 *
 * digits          = ["0","1","0","0","0"]
 * decimal_position = 1   → last 1 digit is fractional
 *
 * Result: "0100" + "." + "0" = 0100.0 → 100.0
 *
 * Leading zeros in the integer part are intentionally preserved during
 * assembly — parseFloat drops them, which is the correct numeric result
 * (0100.0 and 100.0 are the same gallons). The key difference from the
 * old approach is that Gemini is no longer allowed to collapse them while
 * inferring the number — it reports each wheel, and we do the math.
 */
function assembleGallons(digits: string[], decimalPosition: number): number | null {
  if (!digits.length) return null

  const clampedDec = Math.max(0, Math.min(decimalPosition, digits.length - 1))
  const splitAt    = digits.length - clampedDec
  const intPart    = digits.slice(0, splitAt).join("") || "0"
  const decPart    = digits.slice(splitAt).join("")

  const str = decPart.length > 0 ? `${intPart}.${decPart}` : intPart
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

/**
 * Validate that the digit array is self-consistent.
 *
 * Checks:
 *   1. All elements are single 0-9 characters.
 *   2. Total wheel count ≥ MIN_WHEEL_COUNT (business rule: fuel meters have ≥4 wheels).
 *   3. Assembled integer does not have MORE digits than integer-wheel slots
 *      (would mean Gemini invented digits — practically impossible but caught anyway).
 */
function validateDigits(
  digits: string[],
  decimalPosition: number,
  assembled: number,
): { valid: boolean; reason?: string } {
  if (digits.length === 0) {
    return { valid: false, reason: "empty digits array" }
  }

  if (digits.some(d => !/^[0-9]$/.test(d))) {
    return { valid: false, reason: `non-numeric wheel value: [${digits.join(",")}]` }
  }

  if (digits.length < MIN_WHEEL_COUNT) {
    return {
      valid:  false,
      reason: `only ${digits.length} wheels reported, expected ≥${MIN_WHEEL_COUNT} — possible leading-zero collapse`,
    }
  }

  const intWheelCount  = digits.length - Math.max(0, decimalPosition)
  const assembledIntStr = Math.floor(assembled).toString()
  if (assembledIntStr.length > intWheelCount) {
    return {
      valid:  false,
      reason: `assembled integer ${assembledIntStr} (${assembledIntStr.length} digits) exceeds ${intWheelCount} integer wheel slots`,
    }
  }

  return { valid: true }
}

// ─── Structured output schemas ────────────────────────────────────────────────

const DIGIT_FIELDS = {
  readable: { type: "boolean" },
  digits: {
    type:     "array",
    items:    { type: "string" },
    nullable: true,
  },
  decimal_position: {
    type:     "integer",
    nullable: true,
  },
  confidence:    { type: "integer" },
  image_quality: { type: "string", enum: ["good", "fair", "poor"] },
  notes:         { type: "string" },
}

const DIGIT_REQUIRED = ["readable", "digits", "decimal_position", "confidence", "image_quality", "notes"]

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    has_meter:    { type: "boolean" },
    display_type: { type: "string", enum: ["mechanical", "digital", "unknown"] },
    display_region: {
      type:     "object",
      nullable: true,
      properties: {
        x_pct: { type: "number" },
        y_pct: { type: "number" },
        w_pct: { type: "number" },
        h_pct: { type: "number" },
      },
      required: ["x_pct", "y_pct", "w_pct", "h_pct"],
    },
    ...DIGIT_FIELDS,
  },
  required: ["has_meter", "display_type", ...DIGIT_REQUIRED],
}

const READ_SCHEMA = {
  type:       "object",
  properties: DIGIT_FIELDS,
  required:   DIGIT_REQUIRED,
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const DIGIT_INSTRUCTIONS =
  `DIGIT READING RULES — read EACH wheel or digit position separately:\n` +
  `  1. IDENTIFY every wheel/digit position from LEFT to RIGHT. Count them all.\n` +
  `  2. For EACH position, record the single character it shows (0–9). One string per wheel.\n` +
  `  3. NEVER collapse, skip, or ignore a wheel — even if it shows "0".\n` +
  `  4. NEVER infer the total numeric value. Report only what each wheel shows.\n` +
  `  5. decimal_position = how many wheels from the RIGHT are after the decimal point.\n` +
  `     Example: display "0 1 0 0 . 0" → digits=["0","1","0","0","0"] decimal_position=1\n` +
  `     Example: display "3 8 . 6"    → digits=["3","8","6"] decimal_position=1\n` +
  `     Example: display "1 0 2"      → digits=["1","0","2"] decimal_position=0\n\n` +
  `FIELDS:\n` +
  `  readable         → true if you can read at least one wheel\n` +
  `  digits           → array of strings, one entry per wheel, left to right\n` +
  `  decimal_position → integer: wheels from the right that are fractional (0 = whole number)\n` +
  `  confidence       → 0–100: certainty (95=all wheels clear, 70=some estimated, 40=mostly guessed)\n` +
  `  image_quality    → "good" / "fair" / "poor"\n` +
  `  notes            → ≤60 chars: e.g. "5 wheels: 0,1,0,0 clear | wheel 3 estimated"\n\n` +
  `STRICT RULES:\n` +
  `  • If readable=true, digits MUST be a non-empty array — never null.\n` +
  `  • If a wheel is partially visible, estimate its digit and lower confidence.\n` +
  `  • digits=null only when you cannot see a single wheel anywhere.`

const ANALYZE_PROMPT =
  `TASK: OCR extraction from a fuel meter photo. You are a digit reader, not an image describer.\n\n` +
  `STEP 1 — Locate the display:\n` +
  `  Find the numeric counter (odometer drums, LCD, or LED digits).\n` +
  `  Record its bounding box as % of image width/height.\n\n` +
  `STEP 2 — Read wheel by wheel:\n` +
  `${DIGIT_INSTRUCTIONS}\n` +
  `OUTPUT RULES:\n` +
  `  has_meter    → true if a numeric counter is visible anywhere\n` +
  `  display_type → "mechanical" / "digital" / "unknown"\n` +
  `  display_region → bounding box (x_pct, y_pct, w_pct, h_pct in %), or null\n` +
  `  [wheel reading fields as above]`

const READ_PROMPT =
  `TASK: Read the fuel meter display. Wheel-by-wheel digit extraction.\n\n` +
  `The image shows a meter counter — rotating mechanical drums or an LCD/LED display.\n\n` +
  `${DIGIT_INSTRUCTIONS}`

// Strict retry prompts — used after a validation failure on the first attempt.
// Emphasise the wheel count check to prevent leading-zero collapse.
const ANALYZE_PROMPT_STRICT =
  `STRICT RETRY — previous reading may have missed wheels.\n\n` +
  `BEFORE reading digits:\n` +
  `  COUNT every visible rotating drum / LCD digit position from LEFT to RIGHT.\n` +
  `  Write down the total count. Then fill digits[] with EXACTLY that many entries.\n` +
  `  digits.length MUST equal your wheel count. If they differ, you missed a wheel.\n\n` +
  ANALYZE_PROMPT

const READ_PROMPT_STRICT =
  `STRICT RETRY — previous reading may have missed wheels.\n\n` +
  `BEFORE reading digits:\n` +
  `  COUNT every visible rotating drum / LCD digit position from LEFT to RIGHT.\n` +
  `  Write down the total count. Then fill digits[] with EXACTLY that many entries.\n` +
  `  digits.length MUST equal your wheel count. If they differ, you missed a wheel.\n\n` +
  READ_PROMPT

// ─── Robust JSON parser (safety net — structured output should make this rare) ─

type ParsedObject = Record<string, unknown>

function parseGeminiJSON(raw: string, stage: string): ParsedObject {
  console.log(`[Gemini] RAW RESPONSE (${stage}, ${raw.length} chars):`)
  console.log(raw)

  let text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  const start = text.indexOf("{")
  const end   = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1)
  } else if (start !== -1) {
    text = text.slice(start)
    console.warn(`[Gemini] JSON PARSE FAILED: no closing brace found — attempting repair (${stage})`)
  }

  try {
    const result = JSON.parse(text) as ParsedObject
    console.log(`[Gemini] Parsed JSON (${stage}):`, JSON.stringify(result))
    return result
  } catch (e1) {
    console.warn(`[Gemini] JSON PARSE FAILED (${stage}) direct: ${(e1 as Error).message}`)
  }

  const repaired = repairTruncatedJSON(text)
  console.warn(`[Gemini] JSON PARSE FAILED (${stage}) attempting repair: ${repaired.slice(0, 200)}`)
  try {
    const result = JSON.parse(repaired) as ParsedObject
    console.log(`[Gemini] Parsed JSON (${stage}) after repair:`, JSON.stringify(result))
    return result
  } catch (e2) {
    console.error(`[Gemini] JSON PARSE FAILED (${stage}) repair also failed: ${(e2 as Error).message}`)
  }

  throw new ModelResponseError(stage, raw)
}

function repairTruncatedJSON(text: string): string {
  let depth  = 0
  let inStr  = false
  let lastSafePos = -1

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i]
    const prev = i > 0 ? text[i - 1] : ""
    if (ch === '"' && prev !== "\\") inStr = !inStr
    if (inStr) continue
    if (ch === "{" || ch === "[") depth++
    if (ch === "}" || ch === "]") depth--
    if ((ch === "," || ch === "{") && depth === 1) lastSafePos = i
  }

  let truncated = lastSafePos > 0 ? text.slice(0, lastSafePos) : text

  let openBraces = 0, openBrackets = 0
  inStr = false
  for (let i = 0; i < truncated.length; i++) {
    const ch   = truncated[i]
    const prev = i > 0 ? truncated[i - 1] : ""
    if (ch === '"' && prev !== "\\") inStr = !inStr
    if (inStr) continue
    if (ch === "{")  openBraces++
    if (ch === "}")  openBraces--
    if (ch === "[")  openBrackets++
    if (ch === "]")  openBrackets--
  }

  truncated += "]".repeat(Math.max(0, openBrackets))
  truncated += "}".repeat(Math.max(0, openBraces))
  return truncated
}

// ─── Digit extraction helper ──────────────────────────────────────────────────

interface DigitResult {
  readable:        boolean
  digits:          string[] | null
  decimalPosition: number
  confidence:      number
  imageQuality:    "good" | "fair" | "poor"
  notes:           string
  gallons:         number | null  // assembled from digits by application code
}

function extractDigitResult(parsed: ParsedObject, stage: string): DigitResult {
  const readable        = parsed.readable === true
  const rawDigits       = Array.isArray(parsed.digits) ? parsed.digits as unknown[] : null
  const digits          = rawDigits
    ? rawDigits.map(d => String(d).trim()).filter(d => /^[0-9]$/.test(d))
    : null
  const decimalPosition = typeof parsed.decimal_position === "number"
    ? Math.max(0, Math.round(parsed.decimal_position as number))
    : 0
  const confidence      = typeof parsed.confidence === "number"
    ? Math.min(100, Math.max(0, Math.round(parsed.confidence as number)))
    : 0
  const iqRaw           = String(parsed.image_quality ?? "").toLowerCase()
  const imageQuality    = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good"|"fair"|"poor"
  const notes           = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

  let gallons: number | null = null
  if (readable && digits && digits.length > 0) {
    gallons = assembleGallons(digits, decimalPosition)
    const validation = validateDigits(digits, decimalPosition, gallons ?? 0)
    if (!validation.valid) {
      console.warn(`[Gemini] ${stage} digit validation FAILED: ${validation.reason}`)
      console.warn(`[Gemini] ${stage} digits=[${digits.join(",")}] decimal_position=${decimalPosition} assembled=${gallons}`)
    } else {
      console.log(`[Gemini] ${stage} digit validation OK: digits=[${digits.join(",")}] decimal_position=${decimalPosition} assembled=${gallons}`)
    }
  }

  return { readable, digits, decimalPosition, confidence, imageQuality, notes, gallons }
}

function needsStrictRetry(digits: string[] | null, decimalPosition: number, assembled: number | null): boolean {
  if (!digits || digits.length === 0) return false
  if (assembled === null) return true
  const validation = validateDigits(digits, decimalPosition, assembled)
  return !validation.valid
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GeminiMeterProvider implements MeterOCRProviderOptimized {
  readonly name:           string
  readonly supportsOneShot = true as const
  readonly #apiKey:        string
  readonly #model:         string

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.#apiKey = apiKey
    this.#model  = model
    this.name    = `gemini/${model}`
  }

  // ── Low-level caller ────────────────────────────────────────────────────────

  async #call(
    imageBuffer: Buffer,
    prompt:      string,
    stage:       string,
    schema:      object,
  ): Promise<{ text: string; ms: number }> {
    const base64 = imageBuffer.toString("base64")
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${this.#model}:generateContent?key=${this.#apiKey}`

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const delay = BACKOFF_MS[attempt - 2]
        console.log(`[Gemini] ${stage} Intento ${attempt}/${MAX_ATTEMPTS} — esperando ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        console.log(`[Gemini] ${stage} Intento ${attempt}/${MAX_ATTEMPTS}`)
      }

      const generationConfig = {
        temperature:      0,
        maxOutputTokens:  MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseSchema:   schema,
        thinkingConfig:   { thinkingBudget: THINKING_BUDGET },
      }
      console.log(`[Gemini] generationConfig: maxOutputTokens=${generationConfig.maxOutputTokens} thinkingBudget=${THINKING_BUDGET} responseMimeType=${generationConfig.responseMimeType}`)

      const t0  = Date.now()
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64 } },
            ],
          }],
          generationConfig,
        }),
      })
      const ms = Date.now() - t0

      // ── 429 ──────────────────────────────────────────────────────────────
      if (res.status === 429) {
        const rawBody   = await res.text().catch(() => "")
        const maskedKey = this.#apiKey.length >= 8
          ? `${this.#apiKey.slice(0, 4)}...${this.#apiKey.slice(-4)}`
          : "****"

        console.warn(`[Gemini] ══════════════ HTTP 429 RATE LIMIT ══════════════`)
        console.warn(`[Gemini] Stage:   ${stage} — Intento ${attempt}/${MAX_ATTEMPTS}`)
        console.warn(`[Gemini] Model:   ${this.#model}`)
        console.warn(`[Gemini] Endpoint: ${url.replace(/key=[^&]+/, `key=${maskedKey}`)}`)
        console.warn(`[Gemini] API Key: ${maskedKey}`)
        const rh = (h: string) => res.headers.get(h)
        if (rh("Retry-After"))                         console.warn(`[Gemini] Retry-After:                    ${rh("Retry-After")}s`)
        if (rh("x-ratelimit-limit-requests"))          console.warn(`[Gemini] x-ratelimit-limit-requests:     ${rh("x-ratelimit-limit-requests")}`)
        if (rh("x-ratelimit-limit-tokens"))            console.warn(`[Gemini] x-ratelimit-limit-tokens:       ${rh("x-ratelimit-limit-tokens")}`)
        if (rh("x-ratelimit-remaining-requests"))      console.warn(`[Gemini] x-ratelimit-remaining-requests: ${rh("x-ratelimit-remaining-requests")}`)
        if (rh("x-ratelimit-remaining-tokens"))        console.warn(`[Gemini] x-ratelimit-remaining-tokens:   ${rh("x-ratelimit-remaining-tokens")}`)
        if (rh("x-ratelimit-reset-requests"))          console.warn(`[Gemini] x-ratelimit-reset-requests:     ${rh("x-ratelimit-reset-requests")}`)
        if (rh("x-ratelimit-reset-tokens"))            console.warn(`[Gemini] x-ratelimit-reset-tokens:       ${rh("x-ratelimit-reset-tokens")}`)
        console.warn(`[Gemini] Full response body: ${rawBody.slice(0, 1000)}`)
        console.warn(`[Gemini] ════════════════════════════════════════════════`)

        if (attempt === MAX_ATTEMPTS) throw new RateLimitError(this.name, stage, MAX_ATTEMPTS)
        continue
      }

      // ── Other HTTP errors ─────────────────────────────────────────────────
      if (!res.ok) {
        const body = await res.text().catch(() => "unknown")
        throw new Error(`Gemini HTTP ${res.status} (${stage}): ${body.slice(0, 300)}`)
      }

      const data = await res.json() as {
        candidates?: Array<{
          content?:      { parts?: Array<{ text?: string }> }
          finishReason?: string
        }>
      }
      const candidate    = data.candidates?.[0]
      const finishReason = candidate?.finishReason ?? "UNKNOWN"
      const text         = candidate?.content?.parts?.[0]?.text ?? ""

      if (finishReason !== "STOP") {
        console.warn(`[Gemini] ${stage} finishReason=${finishReason} (expected STOP) — response may be incomplete`)
      }

      return { text, ms }
    }

    throw new RateLimitError(this.name, stage, MAX_ATTEMPTS)
  }

  // ── analyzeOnce ─────────────────────────────────────────────────────────────

  async analyzeOnce(
    image: Buffer,
  ): Promise<{ detection: DetectionStage; reading: ReadingStage }> {
    const start = Date.now()
    console.log(`[Gemini] OneShot → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, ANALYZE_PROMPT, "OneShot", ANALYZE_SCHEMA)
      console.log(`[Gemini] OneShot ← ${ms}ms`)

      const parsed = parseGeminiJSON(text, "OneShot")

      const hasDisplay  = parsed.has_meter === true
      const displayType = (["mechanical","digital","unknown"].includes(String(parsed.display_type)))
        ? parsed.display_type as "mechanical" | "digital" | "unknown"
        : "unknown"
      const dr = parsed.display_region as { x_pct?: unknown; y_pct?: unknown; w_pct?: unknown; h_pct?: unknown } | null | undefined
      const boundingBox = (
        dr && typeof dr === "object" &&
        typeof dr.x_pct === "number" && typeof dr.y_pct === "number" &&
        typeof dr.w_pct === "number" && typeof dr.h_pct === "number" &&
        dr.w_pct > 0 && dr.h_pct > 0
      ) ? { xPct: dr.x_pct!, yPct: dr.y_pct!, wPct: dr.w_pct!, hPct: dr.h_pct! } : null

      let result = extractDigitResult(parsed, "OneShot")

      // Strict retry if digit validation failed
      if (result.readable && needsStrictRetry(result.digits, result.decimalPosition, result.gallons)) {
        console.warn(`[Gemini] OneShot digit validation failed — firing strict retry`)
        try {
          const { text: retryText } = await this.#call(image, ANALYZE_PROMPT_STRICT, "OneShot-Strict", ANALYZE_SCHEMA)
          const retryParsed = parseGeminiJSON(retryText, "OneShot-Strict")
          const retryResult = extractDigitResult(retryParsed, "OneShot-Strict")
          if (!needsStrictRetry(retryResult.digits, retryResult.decimalPosition, retryResult.gallons)) {
            console.log(`[Gemini] OneShot-Strict retry improved result — using strict reading`)
            result = retryResult
          } else {
            console.warn(`[Gemini] OneShot-Strict retry still inconsistent — keeping original`)
          }
        } catch (retryErr) {
          console.warn(`[Gemini] OneShot-Strict retry failed: ${(retryErr as Error).message}`)
        }
      }

      const elapsed = Date.now() - start
      console.log(
        `[Gemini] OneShot RESULT: hasDisplay=${hasDisplay} bbox=${boundingBox ? "yes" : "no"} ` +
        `readable=${result.readable} digits=[${(result.digits ?? []).join(",")}] ` +
        `decimalPos=${result.decimalPosition} gallons=${result.gallons} confidence=${result.confidence}% quality=${result.imageQuality}`
      )

      return {
        detection: { hasDisplay, displayType, boundingBox, notes: result.notes, ms: elapsed, rawResponse: text },
        reading:   {
          readable:     result.readable,
          gallons:      result.gallons,
          confidence:   result.confidence,
          imageQuality: result.imageQuality,
          notes:        result.notes,
          ms:           elapsed,
          rawResponse:  text,
        },
      }

    } catch (err) {
      if (err instanceof RateLimitError)     throw err
      if (err instanceof ModelResponseError) throw err

      const msg     = (err as Error).message
      const elapsed = Date.now() - start
      console.error(`[Gemini] OneShot FAILED: ${msg}`)

      return {
        detection: {
          hasDisplay: false, displayType: "unknown", boundingBox: null,
          notes: `OneShot error: ${msg}`, ms: elapsed, rawResponse: "",
        },
        reading: {
          readable: false, gallons: null, confidence: 0, imageQuality: "poor",
          notes: `OneShot error: ${msg}`, ms: elapsed, rawResponse: "",
        },
      }
    }
  }

  // ── detect ──────────────────────────────────────────────────────────────────

  async detect(image: Buffer): Promise<DetectionStage> {
    const { detection } = await this.analyzeOnce(image)
    return detection
  }

  // ── read ────────────────────────────────────────────────────────────────────

  async read(image: Buffer): Promise<ReadingStage> {
    const start = Date.now()
    console.log(`[Gemini] Read → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, READ_PROMPT, "Read", READ_SCHEMA)
      console.log(`[Gemini] Read ← ${ms}ms`)

      const parsed = parseGeminiJSON(text, "Read")
      let result   = extractDigitResult(parsed, "Read")

      // Strict retry if digit validation failed
      if (result.readable && needsStrictRetry(result.digits, result.decimalPosition, result.gallons)) {
        console.warn(`[Gemini] Read digit validation failed — firing strict retry`)
        try {
          const { text: retryText } = await this.#call(image, READ_PROMPT_STRICT, "Read-Strict", READ_SCHEMA)
          const retryParsed = parseGeminiJSON(retryText, "Read-Strict")
          const retryResult = extractDigitResult(retryParsed, "Read-Strict")
          if (!needsStrictRetry(retryResult.digits, retryResult.decimalPosition, retryResult.gallons)) {
            console.log(`[Gemini] Read-Strict retry improved result — using strict reading`)
            result = retryResult
          } else {
            console.warn(`[Gemini] Read-Strict retry still inconsistent — keeping original`)
          }
        } catch (retryErr) {
          console.warn(`[Gemini] Read-Strict retry failed: ${(retryErr as Error).message}`)
        }
      }

      console.log(
        `[Gemini] Read RESULT: readable=${result.readable} digits=[${(result.digits ?? []).join(",")}] ` +
        `decimalPos=${result.decimalPosition} gallons=${result.gallons} confidence=${result.confidence}% quality=${result.imageQuality}`
      )

      return {
        readable:     result.readable,
        gallons:      result.gallons,
        confidence:   result.confidence,
        imageQuality: result.imageQuality,
        notes:        result.notes,
        ms:           Date.now() - start,
        rawResponse:  text,
      }

    } catch (err) {
      if (err instanceof RateLimitError)     throw err
      if (err instanceof ModelResponseError) throw err

      const msg = (err as Error).message
      console.error(`[Gemini] Read FAILED: ${msg}`)
      return {
        readable: false, gallons: null, confidence: 0, imageQuality: "poor",
        notes: `Read error: ${msg}`, ms: Date.now() - start, rawResponse: "",
      }
    }
  }
}
