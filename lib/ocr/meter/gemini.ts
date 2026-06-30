/**
 * FuelOps-DR — Gemini Vision Meter OCR Provider
 *
 * Implements MeterOCRProvider with two specialized Gemini calls:
 *   Stage 1 (detect): Locates the numeric display in the photo
 *   Stage 2 (read):   Reads the gallon value from the display
 *
 * Prompts are engineered for:
 *   - Mechanical dials (rotating drums, odometer-style)
 *   - Digital LCD/LED displays
 *   - Worn/dirty/partially obscured displays
 *   - Various lighting conditions and angles
 *   - Different manufacturers (Bennett, Tokheim, Gilbarco, etc.)
 */

import type { MeterOCRProvider, DetectionStage, ReadingStage } from "./types"

// ─── Stage 1: Detection prompt ────────────────────────────────────────────────
// Asks Gemini to find the display region using % coordinates.
// % coordinates are more reliable than pixels across different image sizes.

const DETECT_PROMPT =
  `You are analyzing a fuel pump or flow meter photo to locate the numeric display.\n\n` +
  `Return ONLY valid JSON — no markdown, no explanation:\n` +
  `{"has_meter":true,"display_type":"mechanical","display_region":{"x_pct":15,"y_pct":30,"w_pct":40,"h_pct":20},"notes":"Odometer-style mechanical display"}\n\n` +
  `Fields:\n` +
  `- has_meter: true if any fuel meter display is visible in the image\n` +
  `- display_type: "mechanical" (rotating drums/odometer), "digital" (LCD/LED), or "unknown"\n` +
  `- display_region: coordinates of ONLY the number area (not the whole meter housing)\n` +
  `    x_pct/y_pct = top-left corner as percent of image width/height (0–100)\n` +
  `    w_pct/h_pct = width/height as percent of image dimensions (0–100)\n` +
  `    Return null if no meter is found\n` +
  `- notes: one English sentence about what you see\n\n` +
  `Focus on the numeric display area only. Ignore hoses, labels, branding.`

// ─── Stage 2: Reading prompt ──────────────────────────────────────────────────
// Engineered to squeeze maximum accuracy even from imperfect images.
// Key principle: always attempt to read — set confidence accordingly.

const READ_PROMPT =
  `You are a specialist in reading fuel meter displays. Analyze this image.\n\n` +
  `Return ONLY valid JSON — no markdown, no explanation:\n` +
  `{"readable":true,"gallons":38.6,"confidence":94,"image_quality":"good","notes":"Digital display clearly shows 38.6"}\n\n` +
  `Fields:\n` +
  `- readable: true if you can read ANY numeric value, even approximately\n` +
  `- gallons: the exact numeric reading shown (include decimal if visible), null ONLY if completely unreadable\n` +
  `- confidence: how certain you are (0=cannot read at all, 70=reasonable guess, 95=crystal clear)\n` +
  `- image_quality: "good" (clear, well-lit), "fair" (somewhat blurry/dark but readable), "poor" (very degraded)\n` +
  `- notes: one English sentence about readability\n\n` +
  `Critical rules:\n` +
  `1. ALWAYS attempt to read — do not refuse just because the image is imperfect\n` +
  `2. If partially visible, read what you can and set confidence accordingly (e.g. 40–60%)\n` +
  `3. Mechanical drum displays: read each wheel separately, combine into one number\n` +
  `4. Worn digits: use context (adjacent visible digits, typical fuel quantities) to infer\n` +
  `5. Ignore everything except the numeric display — labels, hoses, hands, background\n` +
  `6. Only set readable=false if you genuinely see zero numeric information`

// ─── Provider implementation ──────────────────────────────────────────────────

export class GeminiMeterProvider implements MeterOCRProvider {
  readonly name: string
  readonly #apiKey: string
  readonly #model:  string

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.#apiKey = apiKey
    this.#model  = model
    this.name    = `gemini/${model}`
  }

  // ── Shared Gemini caller ────────────────────────────────────────────────────

  async #call(imageBuffer: Buffer, prompt: string): Promise<{ text: string; ms: number }> {
    const base64 = imageBuffer.toString("base64")
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${this.#model}:generateContent?key=${this.#apiKey}`
    const start  = Date.now()

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
        generationConfig: { temperature: 0, maxOutputTokens: 300 },
      }),
    })

    const ms = Date.now() - start

    if (!res.ok) {
      const errBody = await res.text().catch(() => "unknown")
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data    = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text    = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    return { text, ms }
  }

  // ── Stage 1: Detect display ─────────────────────────────────────────────────

  async detect(image: Buffer): Promise<DetectionStage> {
    const start = Date.now()
    console.log(`[OCR/S1/Detect] → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, DETECT_PROMPT)
      console.log(`[OCR/S1/Detect] ← ${ms}ms raw: ${text.slice(0, 250)}`)

      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as {
        has_meter?:      unknown
        display_type?:   unknown
        display_region?: { x_pct?: unknown; y_pct?: unknown; w_pct?: unknown; h_pct?: unknown } | null
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
      ) ? {
        xPct: dr.x_pct!, yPct: dr.y_pct!,
        wPct: dr.w_pct!, hPct: dr.h_pct!,
      } : null

      const notes = typeof parsed.notes === "string" ? parsed.notes : ""

      console.log(
        `[OCR/S1/Detect] hasDisplay=${hasDisplay} type=${displayType} ` +
        `bbox=${boundingBox ? `[${boundingBox.xPct},${boundingBox.yPct} ${boundingBox.wPct}×${boundingBox.hPct}%]` : "none"}`
      )

      return { hasDisplay, displayType, boundingBox, notes, ms: Date.now() - start, rawResponse: text }
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[OCR/S1/Detect] FAILED: ${msg}`)
      return {
        hasDisplay: false, displayType: "unknown", boundingBox: null,
        notes: `Detection error: ${msg}`, ms: Date.now() - start, rawResponse: "",
      }
    }
  }

  // ── Stage 2: Read value ─────────────────────────────────────────────────────

  async read(image: Buffer): Promise<ReadingStage> {
    const start = Date.now()
    console.log(`[OCR/S2/Read] → ${this.#model} | ${image.length}B`)

    try {
      const { text, ms } = await this.#call(image, READ_PROMPT)
      console.log(`[OCR/S2/Read] ← ${ms}ms raw: ${text.slice(0, 300)}`)

      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as {
        readable?:      unknown
        gallons?:       unknown
        confidence?:    unknown
        image_quality?: unknown
        notes?:         unknown
      }

      const readable     = parsed.readable === true
      const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons    : null
      const confidence   = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0
      const iqRaw        = String(parsed.image_quality ?? "").toLowerCase()
      const imageQuality = (["good","fair","poor"].includes(iqRaw) ? iqRaw : "poor") as "good" | "fair" | "poor"
      const notes        = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : ""

      console.log(
        `[OCR/S2/Read] readable=${readable} gallons=${gallons} ` +
        `confidence=${confidence}% quality=${imageQuality} notes="${notes}"`
      )

      return { readable, gallons, confidence, imageQuality, notes, ms: Date.now() - start, rawResponse: text }
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[OCR/S2/Read] FAILED: ${msg}`)
      return {
        readable:     false,
        gallons:      null,
        confidence:   0,
        imageQuality: "poor",
        notes:        `Reading error: ${msg}`,
        ms:           Date.now() - start,
        rawResponse:  "",
      }
    }
  }
}
