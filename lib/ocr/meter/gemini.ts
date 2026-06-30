/**
 * FuelOps-DR — Gemini Vision Meter OCR Provider
 *
 * JSON reliability strategy (three layers):
 *
 *   Layer 1 — Structured output: responseSchema forces Gemini to output JSON
 *             matching the schema exactly. No fences, no preamble, no truncation.
 *             This is the primary fix for "Unterminated string" errors.
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

// maxOutputTokens: kept at 1024 (well above the ~150 tokens a full JSON response needs).
// The real cause of MAX_TOKENS truncation on Gemini 2.5 Flash is the internal
// "thinking" step — the model reasons silently before outputting and those tokens
// count against this budget. thinkingBudget: 0 disables thinking entirely,
// giving all 1024 tokens to the actual JSON output.
const MAX_OUTPUT_TOKENS  = 1024
const THINKING_BUDGET    = 0     // disable thinking to preserve output token budget

// ─── Structured output schemas ────────────────────────────────────────────────
// responseSchema + responseMimeType: "application/json" forces Gemini to emit
// valid JSON that matches the schema. No markdown, no truncation mid-field.

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    has_meter:      { type: "boolean" },
    display_type:   { type: "string", enum: ["mechanical", "digital", "unknown"] },
    display_region: {
      type: "object",
      nullable: true,
      properties: {
        x_pct: { type: "number" },
        y_pct: { type: "number" },
        w_pct: { type: "number" },
        h_pct: { type: "number" },
      },
      required: ["x_pct", "y_pct", "w_pct", "h_pct"],
    },
    readable:      { type: "boolean" },
    // gallons is required — Gemini must always emit this field.
    // nullable: true allows null only when truly no digit is visible.
    gallons:       { type: "number",  nullable: true },
    confidence:    { type: "integer" },
    image_quality: { type: "string",  enum: ["good", "fair", "poor"] },
    notes:         { type: "string" },
  },
  required: ["has_meter", "display_type", "readable", "gallons", "confidence", "image_quality", "notes"],
}

const READ_SCHEMA = {
  type: "object",
  properties: {
    readable:      { type: "boolean" },
    // gallons is required — Gemini must always emit this field.
    // nullable: true allows null only when truly no digit is visible.
    gallons:       { type: "number",  nullable: true },
    confidence:    { type: "integer" },
    image_quality: { type: "string",  enum: ["good", "fair", "poor"] },
    notes:         { type: "string" },
  },
  required: ["readable", "gallons", "confidence", "image_quality", "notes"],
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// ANALYZE_PROMPT — combined locate + read in one call.
// Written as a pure digit-extraction task, not image description.
// Key principle: gallons is ALWAYS required. The model must commit to a number
// or explicitly return null — it cannot skip the field or defer.
const ANALYZE_PROMPT =
  `TASK: OCR extraction from a fuel meter photo. You are a digit reader, not an image describer.\n\n` +
  `STEP 1 — Locate the display:\n` +
  `  Find the numeric counter (odometer drums, LCD, or LED digits).\n` +
  `  Record its bounding box as % of image width/height.\n\n` +
  `STEP 2 — Read the number:\n` +
  `  Read EVERY digit you can see, left to right.\n` +
  `  For mechanical drum displays: read each rotating wheel as one digit.\n` +
  `  For partially obscured digits: estimate from the visible portion and adjacent context.\n` +
  `  Combine all digits into a single decimal number (e.g. 38.6, 102, 7.50).\n` +
  `  DO NOT describe the meter. DO NOT explain what you see. Just output the number.\n\n` +
  `OUTPUT RULES — you MUST always populate every field:\n` +
  `  has_meter    → true if a numeric counter is visible anywhere in the image\n` +
  `  display_type → "mechanical" / "digital" / "unknown"\n` +
  `  display_region → bounding box of the digit area in % (x_pct, y_pct, w_pct, h_pct), or null\n` +
  `  readable     → true if you extracted any numeric value, even a partial estimate\n` +
  `  gallons      → the numeric reading as a decimal (38.6, 102.0, 7.5). ` +
                   `MUST be a number if readable=true. ` +
                   `Set to null ONLY if you cannot distinguish a single digit anywhere.\n` +
  `  confidence   → integer 0–100: how certain you are of the exact value ` +
                   `(95=all digits clear, 70=some digits estimated, 40=mostly guessed, 0=no digits seen)\n` +
  `  image_quality → "good" / "fair" / "poor"\n` +
  `  notes        → ≤60 chars: which digits were clear vs. estimated (e.g. "digits 1-3 clear, digit 4 estimated")\n\n` +
  `STRICT RULES:\n` +
  `  • If readable=true, gallons MUST be a number — never null.\n` +
  `  • If you see partial digits, commit to your best reading and lower confidence.\n` +
  `  • Ignore brand labels, hoses, hands, and background — only read the digit counter.\n` +
  `  • gallons=null is only valid when you see zero recognizable digits.`

// READ_PROMPT — focused second pass on a cropped display image.
// Even more direct: the image IS the display, just read the digits.
const READ_PROMPT =
  `TASK: Read the number shown on this fuel meter display. Pure digit extraction.\n\n` +
  `The image shows a meter counter — either rotating mechanical drums or an LCD/LED display.\n` +
  `Read every digit left to right and return the complete numeric value.\n\n` +
  `OUTPUT RULES — all fields are required:\n` +
  `  readable     → true if you can extract any numeric value\n` +
  `  gallons      → the reading as a decimal number (e.g. 38.6, 102.0). ` +
                   `MUST be a number if readable=true. ` +
                   `null ONLY if you cannot identify a single digit.\n` +
  `  confidence   → 0–100: certainty of the exact value ` +
                   `(95=all digits clear, 70=some estimated, 40=mostly guessed)\n` +
  `  image_quality → "good" / "fair" / "poor"\n` +
  `  notes        → ≤60 chars describing which digits were clear vs. estimated\n\n` +
  `STRICT RULES:\n` +
  `  • readable=true means gallons MUST be a number, never null.\n` +
  `  • Partial reading is better than no reading — estimate missing digits, lower confidence.\n` +
  `  • Do not describe the device. Output only the extracted number and confidence.\n` +
  `  • gallons=null only if you genuinely see no recognizable digit anywhere.`

// ─── Robust JSON parser (safety net — structured output should make this rare) ─

type ParsedObject = Record<string, unknown>

function parseGeminiJSON(raw: string, stage: string): ParsedObject {
  // Always log the full raw response first
  console.log(`[Gemini] RAW RESPONSE (${stage}, ${raw.length} chars):`)
  console.log(raw)

  // Layer 1: strip markdown code fences
  let text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  // Layer 2: extract first {...} block
  const start = text.indexOf("{")
  const end   = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1)
  } else if (start !== -1) {
    text = text.slice(start)
    console.warn(`[Gemini] JSON PARSE FAILED: no closing brace found — attempting repair (${stage})`)
  }

  // Layer 3: direct parse
  try {
    const result = JSON.parse(text) as ParsedObject
    console.log(`[Gemini] Parsed JSON (${stage}):`, JSON.stringify(result))
    return result
  } catch (e1) {
    console.warn(`[Gemini] JSON PARSE FAILED (${stage}) direct: ${(e1 as Error).message}`)
  }

  // Layer 4: repair truncated JSON then retry
  const repaired = repairTruncatedJSON(text)
  console.warn(`[Gemini] JSON PARSE FAILED (${stage}) attempting repair: ${repaired.slice(0, 200)}`)
  try {
    const result = JSON.parse(repaired) as ParsedObject
    console.log(`[Gemini] Parsed JSON (${stage}) after repair:`, JSON.stringify(result))
    return result
  } catch (e2) {
    console.error(`[Gemini] JSON PARSE FAILED (${stage}) repair also failed: ${(e2 as Error).message}`)
  }

  // All attempts exhausted — throw ModelResponseError so caller can respond correctly
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

      // parseGeminiJSON logs [Gemini] RAW RESPONSE and [Gemini] Parsed JSON internally
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

      const readable     = parsed.readable === true
      const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons : null
      const confidence   = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence as number))) : 0
      const iqRaw        = String(parsed.image_quality ?? "").toLowerCase()
      const imageQuality = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good"|"fair"|"poor"
      const notes        = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

      const elapsed = Date.now() - start
      console.log(
        `[Gemini] OneShot RESULT: hasDisplay=${hasDisplay} bbox=${boundingBox ? "yes" : "no"} ` +
        `readable=${readable} gallons=${gallons} confidence=${confidence}% quality=${imageQuality}`
      )

      return {
        detection: { hasDisplay, displayType, boundingBox, notes, ms: elapsed, rawResponse: text },
        reading:   { readable, gallons, confidence, imageQuality, notes, ms: elapsed, rawResponse: text },
      }

    } catch (err) {
      if (err instanceof RateLimitError)    throw err
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

      const readable     = parsed.readable === true
      const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons : null
      const confidence   = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence as number))) : 0
      const iqRaw        = String(parsed.image_quality ?? "").toLowerCase()
      const imageQuality = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good"|"fair"|"poor"
      const notes        = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

      console.log(
        `[Gemini] Read RESULT: readable=${readable} gallons=${gallons} ` +
        `confidence=${confidence}% quality=${imageQuality}`
      )

      return {
        readable, gallons, confidence, imageQuality, notes,
        ms: Date.now() - start, rawResponse: text,
      }

    } catch (err) {
      if (err instanceof RateLimitError)    throw err
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
