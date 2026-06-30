/**
 * FuelOps-DR — Gemini Vision Meter OCR Provider
 *
 * Implements MeterOCRProvider + MeterOCRProviderOptimized.
 *
 * One-shot mode (default):
 *   Single Gemini call detects the display AND reads the value.
 *   If confidence ≥ 85%, the engine uses that result directly (1 call total).
 *   If confidence < 85% AND a display region was found, the engine crops
 *   and calls provider.read() on the focused crop (2 calls total).
 *
 * Rate-limit handling:
 *   Each API call retries up to MAX_ATTEMPTS (3) with exponential backoff
 *   (2 s → 4 s). If all attempts fail with HTTP 429, throws RateLimitError.
 *   Any other HTTP error fails immediately (no retry).
 */

import type {
  MeterOCRProviderOptimized,
  DetectionStage,
  ReadingStage,
} from "./types"
import { RateLimitError } from "./types"

// ─── Retry config ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3
const BACKOFF_MS   = [2000, 4000] // delay before attempt 2, then attempt 3

// ─── Prompts ──────────────────────────────────────────────────────────────────

/**
 * Combined detect+read prompt.
 * One call returns both the display bounding box AND the numeric reading.
 * Reduces API usage by 50 % for high-confidence images.
 */
const ANALYZE_PROMPT =
  `You are a specialist in reading fuel pump and flow meter displays.\n\n` +
  `Return ONLY valid JSON — no markdown, no explanation:\n` +
  `{"has_meter":true,"display_type":"mechanical","display_region":{"x_pct":15,"y_pct":30,"w_pct":40,"h_pct":20},"readable":true,"gallons":38.6,"confidence":94,"image_quality":"good","notes":"Odometer-style display clearly shows 38.6"}\n\n` +
  `Fields:\n` +
  `- has_meter: true if any fuel meter display is visible\n` +
  `- display_type: "mechanical" (rotating drums/odometer), "digital" (LCD/LED), or "unknown"\n` +
  `- display_region: top-left + size of the NUMBER AREA ONLY in % of image dimensions (0–100), or null if no meter\n` +
  `- readable: true if you can read ANY numeric value, even approximately\n` +
  `- gallons: exact numeric reading (include decimal if visible), null ONLY if completely unreadable\n` +
  `- confidence: 0=cannot read, 70=reasonable guess, 95=crystal clear\n` +
  `- image_quality: "good" (clear/well-lit), "fair" (blurry/dark but readable), "poor" (very degraded)\n` +
  `- notes: one English sentence about what you see\n\n` +
  `Critical rules:\n` +
  `1. ALWAYS attempt to read — do not refuse just because the image is imperfect\n` +
  `2. If partially visible, read what you can and set confidence accordingly (40–60%)\n` +
  `3. Mechanical drum displays: read each wheel separately, combine into one number\n` +
  `4. Worn digits: use context (adjacent visible digits, typical fuel quantities) to infer\n` +
  `5. Ignore everything except the numeric display — labels, hoses, hands, background\n` +
  `6. Only set readable=false if you genuinely see zero numeric information`

/**
 * Focused read-only prompt — used for the optional second pass on a cropped display.
 */
const READ_PROMPT =
  `You are a specialist in reading fuel meter displays. Analyze this image.\n\n` +
  `Return ONLY valid JSON — no markdown, no explanation:\n` +
  `{"readable":true,"gallons":38.6,"confidence":94,"image_quality":"good","notes":"Digital display clearly shows 38.6"}\n\n` +
  `Fields:\n` +
  `- readable: true if you can read ANY numeric value, even approximately\n` +
  `- gallons: the exact numeric reading shown (include decimal if visible), null ONLY if completely unreadable\n` +
  `- confidence: 0=cannot read, 70=reasonable guess, 95=crystal clear\n` +
  `- image_quality: "good" (clear/well-lit), "fair" (blurry/dark but readable), "poor" (very degraded)\n` +
  `- notes: one English sentence about readability\n\n` +
  `Critical rules:\n` +
  `1. ALWAYS attempt to read — do not refuse just because the image is imperfect\n` +
  `2. If partially visible, read what you can and set confidence accordingly (40–60%)\n` +
  `3. Mechanical drum displays: read each wheel separately, combine into one number\n` +
  `4. Worn digits: use context (adjacent visible digits, typical fuel quantities) to infer\n` +
  `5. Ignore everything except the numeric display — labels, hoses, hands, background\n` +
  `6. Only set readable=false if you genuinely see zero numeric information`

// ─── Provider implementation ──────────────────────────────────────────────────

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

  // ── Low-level caller with exponential-backoff retry on 429 ──────────────────

  async #call(
    imageBuffer: Buffer,
    prompt:      string,
    stage:       string,
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
          generationConfig: { temperature: 0, maxOutputTokens: 400 },
        }),
      })
      const ms = Date.now() - t0

      // ── 429: log full diagnostic info and retry ────────────────────────────
      if (res.status === 429) {
        const rawBody    = await res.text().catch(() => "")
        const maskedKey  = this.#apiKey.length >= 8
          ? `${this.#apiKey.slice(0, 4)}...${this.#apiKey.slice(-4)}`
          : "****"
        const retryAfter = res.headers.get("Retry-After")
        const limitReq   = res.headers.get("x-ratelimit-limit-requests")
        const limitTok   = res.headers.get("x-ratelimit-limit-tokens")
        const remReq     = res.headers.get("x-ratelimit-remaining-requests")
        const remTok     = res.headers.get("x-ratelimit-remaining-tokens")
        const resetReq   = res.headers.get("x-ratelimit-reset-requests")
        const resetTok   = res.headers.get("x-ratelimit-reset-tokens")

        console.warn(`[Gemini] ══════════════ HTTP 429 RATE LIMIT ══════════════`)
        console.warn(`[Gemini] Stage:        ${stage} — Intento ${attempt}/${MAX_ATTEMPTS}`)
        console.warn(`[Gemini] Model:        ${this.#model}`)
        console.warn(`[Gemini] Endpoint:     ${url.replace(/key=[^&]+/, `key=${maskedKey}`)}`)
        console.warn(`[Gemini] API Key:      ${maskedKey}`)
        if (retryAfter) console.warn(`[Gemini] Retry-After: ${retryAfter}s`)
        if (limitReq)   console.warn(`[Gemini] x-ratelimit-limit-requests:     ${limitReq}`)
        if (limitTok)   console.warn(`[Gemini] x-ratelimit-limit-tokens:       ${limitTok}`)
        if (remReq)     console.warn(`[Gemini] x-ratelimit-remaining-requests: ${remReq}`)
        if (remTok)     console.warn(`[Gemini] x-ratelimit-remaining-tokens:   ${remTok}`)
        if (resetReq)   console.warn(`[Gemini] x-ratelimit-reset-requests:     ${resetReq}`)
        if (resetTok)   console.warn(`[Gemini] x-ratelimit-reset-tokens:       ${resetTok}`)
        console.warn(`[Gemini] Full response body: ${rawBody.slice(0, 1000)}`)
        console.warn(`[Gemini] ════════════════════════════════════════════════`)

        if (attempt === MAX_ATTEMPTS) {
          throw new RateLimitError(this.name, stage, MAX_ATTEMPTS)
        }
        continue // back to top of loop → wait + retry
      }

      // ── Other HTTP errors: fail fast ───────────────────────────────────────
      if (!res.ok) {
        const body = await res.text().catch(() => "unknown")
        throw new Error(`Gemini HTTP ${res.status} (${stage}): ${body.slice(0, 200)}`)
      }

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
      return { text, ms }
    }

    // Unreachable — TypeScript needs an explicit return path after the loop
    throw new RateLimitError(this.name, stage, MAX_ATTEMPTS)
  }

  // ── analyzeOnce: combined detect + read in a single API call ────────────────

  async analyzeOnce(
    image: Buffer,
  ): Promise<{ detection: DetectionStage; reading: ReadingStage }> {
    const start = Date.now()
    console.log(`[Gemini] OneShot → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, ANALYZE_PROMPT, "OneShot")
      console.log(`[Gemini] OneShot ← ${ms}ms raw: ${text.slice(0, 300)}`)

      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as {
        has_meter?:      unknown
        display_type?:   unknown
        display_region?: { x_pct?: unknown; y_pct?: unknown; w_pct?: unknown; h_pct?: unknown } | null
        readable?:       unknown
        gallons?:        unknown
        confidence?:     unknown
        image_quality?:  unknown
        notes?:          unknown
      }

      const hasDisplay  = parsed.has_meter === true
      const displayType = (["mechanical","digital","unknown"].includes(String(parsed.display_type)))
        ? parsed.display_type as "mechanical" | "digital" | "unknown"
        : "unknown"
      const dr = parsed.display_region
      const boundingBox = (
        dr && typeof dr === "object" &&
        typeof dr.x_pct === "number" && typeof dr.y_pct === "number" &&
        typeof dr.w_pct === "number" && typeof dr.h_pct === "number" &&
        dr.w_pct > 0 && dr.h_pct > 0
      ) ? { xPct: dr.x_pct!, yPct: dr.y_pct!, wPct: dr.w_pct!, hPct: dr.h_pct! } : null

      const readable     = parsed.readable === true
      const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons : null
      const confidence   = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0
      const iqRaw        = String(parsed.image_quality ?? "").toLowerCase()
      const imageQuality = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good"|"fair"|"poor"
      const notes        = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

      const elapsed = Date.now() - start
      console.log(
        `[Gemini] OneShot hasDisplay=${hasDisplay} bbox=${boundingBox ? "yes" : "no"} ` +
        `readable=${readable} gallons=${gallons} confidence=${confidence}% quality=${imageQuality}`
      )

      return {
        detection: { hasDisplay, displayType, boundingBox, notes, ms: elapsed, rawResponse: text },
        reading:   { readable, gallons, confidence, imageQuality, notes, ms: elapsed, rawResponse: text },
      }

    } catch (err) {
      if (err instanceof RateLimitError) throw err  // propagate as-is

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

  // ── detect: required by MeterOCRProvider (delegates to analyzeOnce) ─────────

  async detect(image: Buffer): Promise<DetectionStage> {
    const { detection } = await this.analyzeOnce(image)
    return detection
  }

  // ── read: focused second pass on a cropped display image ────────────────────

  async read(image: Buffer): Promise<ReadingStage> {
    const start = Date.now()
    console.log(`[Gemini] Read → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, READ_PROMPT, "Read")
      console.log(`[Gemini] Read ← ${ms}ms raw: ${text.slice(0, 300)}`)

      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as {
        readable?:      unknown
        gallons?:       unknown
        confidence?:    unknown
        image_quality?: unknown
        notes?:         unknown
      }

      const readable     = parsed.readable === true
      const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons : null
      const confidence   = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0
      const iqRaw        = String(parsed.image_quality ?? "").toLowerCase()
      const imageQuality = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good"|"fair"|"poor"
      const notes        = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

      console.log(
        `[Gemini] Read readable=${readable} gallons=${gallons} ` +
        `confidence=${confidence}% quality=${imageQuality}`
      )

      return {
        readable, gallons, confidence, imageQuality, notes,
        ms: Date.now() - start, rawResponse: text,
      }

    } catch (err) {
      if (err instanceof RateLimitError) throw err  // propagate as-is

      const msg = (err as Error).message
      console.error(`[Gemini] Read FAILED: ${msg}`)
      return {
        readable:     false,
        gallons:      null,
        confidence:   0,
        imageQuality: "poor",
        notes:        `Read error: ${msg}`,
        ms:           Date.now() - start,
        rawResponse:  "",
      }
    }
  }
}
