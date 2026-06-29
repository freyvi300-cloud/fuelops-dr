/**
 * FuelOps-DR — WhatsApp Meter Image OCR (Phase 3.2)
 *
 * Uses Gemini Vision to analyze fuel meter photos received via WhatsApp.
 * Returns structured OCR data with gallons, confidence, quality, and notes.
 *
 * Design principle: this module only knows about images and OCR.
 * It does NOT talk to WhatsApp, Supabase, or the DB — that's commands.ts job.
 */

export interface MeterAnalysisResult {
  gallons:      number | null          // meter reading, null if unreadable
  confidence:   number                 // 0-100
  imageQuality: "buena" | "regular" | "mala"
  notes:        string                 // brief observation in Spanish
  provider:     string                 // "gemini/gemini-2.0-flash"
  processingMs: number
  rawText:      string                 // raw Gemini response for debugging
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
// Optimized for WhatsApp photos: varied angles, lighting, zoom levels.

const PROMPT =
  `You are a fuel meter reading specialist. Analyze this photo of a fuel meter display.\n\n` +
  `Return ONLY a valid JSON object (no markdown, no text before or after):\n` +
  `{"gallons":<number|null>,"confidence":<0-100>,"image_quality":"<buena|regular|mala>","notes":"<brief Spanish observation>"}\n\n` +
  `Rules:\n` +
  `- gallons: exact numeric value shown on the meter (decimal if visible), null if completely unreadable\n` +
  `- confidence: 0=cannot read at all, 50=partially readable, 100=perfectly clear\n` +
  `- image_quality: "buena"=clear and well-lit, "regular"=slightly blurry/dark but readable, "mala"=too blurry/dark/angled\n` +
  `- notes: one short Spanish sentence describing the readability (e.g. "Display digital claro", "Imagen borrosa", "Ángulo incorrecto, texto ilegible")`

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeMeterImage(
  buffer: Buffer,
): Promise<MeterAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no configurado. Agrégalo en Vercel → Settings → Environment Variables."
    )
  }

  const model  = "gemini-2.0-flash"
  const base64 = buffer.toString("base64")
  const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  console.log(`[Gemini/OCR] START — model=${model} imageSize=${buffer.length}B`)

  const start = Date.now()
  let rawText = ""

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 200 },
      }),
    })

    const ms = Date.now() - start

    if (!res.ok) {
      const errBody = await res.text().catch(() => "unknown")
      console.error(`[Gemini/OCR] FAILED HTTP ${res.status}: ${errBody.slice(0, 300)}`)
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    console.log(`[Gemini/OCR] Response (${ms}ms): ${rawText.slice(0, 400)}`)

    return { ...parseGeminiResponse(rawText, model), processingMs: ms }
  } catch (err) {
    const ms = Date.now() - start
    const e  = err as Error
    console.error(`[Gemini/OCR] FAILED: ${e.message}`)
    console.error(`[Gemini/OCR] cause: ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    throw e
  }
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseGeminiResponse(rawText: string, model: string): Omit<MeterAnalysisResult, "processingMs"> {
  const provider = `gemini/${model}`

  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim()
    const parsed  = JSON.parse(cleaned) as {
      gallons?:       unknown
      confidence?:    unknown
      image_quality?: unknown
      notes?:         unknown
    }

    const gallons      = typeof parsed.gallons    === "number" ? parsed.gallons : null
    const confidence   = typeof parsed.confidence === "number"
      ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0
    const qualityRaw   = typeof parsed.image_quality === "string" ? parsed.image_quality.toLowerCase() : ""
    const imageQuality: "buena" | "regular" | "mala" =
      qualityRaw === "buena" ? "buena" : qualityRaw === "regular" ? "regular" : "mala"
    const notes = typeof parsed.notes === "string" ? parsed.notes.slice(0, 200) : ""

    console.log(
      `[Gemini/OCR] Parsed: gallons=${gallons} confidence=${confidence}% ` +
      `quality=${imageQuality} notes="${notes}"`
    )

    return { gallons, confidence, imageQuality, notes, provider, rawText }
  } catch (parseErr) {
    console.error(`[Gemini/OCR] JSON parse error: ${(parseErr as Error).message}`)
    console.error(`[Gemini/OCR] Raw text was: ${rawText.slice(0, 300)}`)
    return {
      gallons:      null,
      confidence:   0,
      imageQuality: "mala",
      notes:        "Error al interpretar la respuesta de IA",
      provider,
      rawText,
    }
  }
}
