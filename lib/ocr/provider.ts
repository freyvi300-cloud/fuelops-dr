/**
 * FuelOps-DR — OpenAI Vision OCR Provider
 *
 * Implements OCRProvider using OpenAI gpt-4o-mini with vision capability.
 * Uses native fetch (no openai npm package needed) — easier to swap.
 *
 * To add a new provider (e.g. Gemini):
 *   export class GeminiOCRProvider implements OCRProvider { ... }
 */

import type { OCRProvider, OCRResult } from "./types"

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

const SYSTEM_PROMPT = `You are a fuel meter reader.
Given an image of a fuel meter display, return ONLY a valid JSON object — no markdown, no explanation:
{"gallons": <number or null>, "confidence": <0-100>}

Rules:
- gallons: the exact numeric reading shown on the meter (decimal if present), null if unreadable
- confidence: 0 = completely unreadable, 100 = crystal clear reading`

export class OpenAIVisionProvider implements OCRProvider {
  private apiKey: string
  private model:  string

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey
    this.model  = model
  }

  async readMeter(imageBuffer: Buffer): Promise<OCRResult> {
    const start  = Date.now()
    const base64 = imageBuffer.toString("base64")

    const body = {
      model:      this.model,
      messages: [{
        role:    "user",
        content: [
          { type: "text", text: SYSTEM_PROMPT },
          {
            type:      "image_url",
            image_url: {
              // "low" = cheaper + faster; sufficient for meter digit reading
              url:    `data:image/jpeg;base64,${base64}`,
              detail: "low",
            },
          },
        ],
      }],
      max_tokens:  100,
      temperature: 0,
    }

    const response = await fetch(OPENAI_API_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    })

    const processingMs = Date.now() - start

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown error")
      throw new Error(`OpenAI API ${response.status}: ${errText}`)
    }

    const data    = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const rawText = data.choices?.[0]?.message?.content ?? ""

    return this.#parseResponse(rawText, processingMs)
  }

  #parseResponse(rawText: string, processingMs: number): OCRResult {
    try {
      // Strip markdown code fences that some models add despite instructions
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as { gallons?: unknown; confidence?: unknown }

      const gallons    = typeof parsed.gallons    === "number" ? parsed.gallons    : null
      const confidence = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, parsed.confidence))
        : 0

      return { gallons, confidence, rawText, provider: `openai/${this.model}`, processingMs }
    } catch {
      // JSON parse failed — model returned non-JSON text
      return { gallons: null, confidence: 0, rawText, provider: `openai/${this.model}`, processingMs }
    }
  }
}
