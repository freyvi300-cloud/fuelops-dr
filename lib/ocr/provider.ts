/**
 * FuelOps-DR — OCR Providers
 *
 * Add a new provider:
 *   1. Implement the OCRProvider interface (lib/ocr/types.ts)
 *   2. Export the class from this file
 *   3. Register it in lib/ocr/index.ts
 *
 * Available providers:
 *   OpenAIVisionProvider  ← OpenAI gpt-4o-mini Vision
 *   GeminiVisionProvider  ← Google Gemini 2.0 Flash
 *   MockOCRProvider       ← Deterministic fake (testing, no API key needed)
 */

import type { OCRProvider, OCRResult } from "./types"

// ─── Shared prompt ────────────────────────────────────────────────────────────

const METER_PROMPT =
  "This is a fuel meter display. Analyze the numeric reading and return ONLY valid JSON " +
  "(no markdown, no explanation):\n" +
  '{"gallons": <number or null>, "confidence": <0-100>}\n\n' +
  "gallons: exact numeric reading shown (decimal if present), null if unreadable\n" +
  "confidence: 0=unreadable, 100=crystal clear"

// ─── Helper: parse provider JSON response ─────────────────────────────────────

function parseJSON(
  rawText: string,
  providerName: string,
  processingMs: number,
): OCRResult {
  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim()
    const parsed  = JSON.parse(cleaned) as { gallons?: unknown; confidence?: unknown }
    return {
      gallons:      typeof parsed.gallons    === "number" ? parsed.gallons    : null,
      confidence:   typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, parsed.confidence)) : 0,
      rawText,
      provider:     providerName,
      processingMs,
    }
  } catch {
    return { gallons: null, confidence: 0, rawText, provider: providerName, processingMs }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OpenAI Vision
// ═══════════════════════════════════════════════════════════════════════════════

export class OpenAIVisionProvider implements OCRProvider {
  readonly #apiKey: string
  readonly #model:  string

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.#apiKey = apiKey
    this.#model  = model
  }

  async readMeter(imageBuffer: Buffer): Promise<OCRResult> {
    const start  = Date.now()
    const base64 = imageBuffer.toString("base64")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${this.#apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       this.#model,
        messages: [{
          role:    "user",
          content: [
            { type: "text", text: METER_PROMPT },
            {
              type:      "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "low" },
            },
          ],
        }],
        max_tokens:  100,
        temperature: 0,
      }),
    })

    const ms = Date.now() - start
    if (!response.ok) {
      const err = await response.text().catch(() => "unknown")
      throw new Error(`OpenAI ${response.status}: ${err}`)
    }

    const data    = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const rawText = data.choices?.[0]?.message?.content ?? ""
    return parseJSON(rawText, `openai/${this.#model}`, ms)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Google Gemini Vision
// ═══════════════════════════════════════════════════════════════════════════════

export class GeminiVisionProvider implements OCRProvider {
  readonly #apiKey: string
  readonly #model:  string

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.#apiKey = apiKey
    this.#model  = model
  }

  async readMeter(imageBuffer: Buffer): Promise<OCRResult> {
    const start  = Date.now()
    const base64 = imageBuffer.toString("base64")
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${this.#model}:generateContent?key=${this.#apiKey}`

    const response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: METER_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 100 },
      }),
    })

    const ms = Date.now() - start
    if (!response.ok) {
      const err = await response.text().catch(() => "unknown")
      throw new Error(`Gemini ${response.status}: ${err}`)
    }

    const data    = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    return parseJSON(rawText, `gemini/${this.#model}`, ms)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Mock (testing — no API key needed, deterministic output)
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_GALLONS    = 73.50
const MOCK_CONFIDENCE = 97

export class MockOCRProvider implements OCRProvider {
  async readMeter(_image: Buffer): Promise<OCRResult> {
    const start = Date.now()
    await new Promise(r => setTimeout(r, 400))   // simulate API latency
    const ms = Date.now() - start

    return {
      gallons:      MOCK_GALLONS,
      confidence:   MOCK_CONFIDENCE,
      rawText:      JSON.stringify({ gallons: MOCK_GALLONS, confidence: MOCK_CONFIDENCE }),
      provider:     "mock/test",
      processingMs: ms,
    }
  }
}
