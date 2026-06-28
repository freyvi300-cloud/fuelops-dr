/**
 * FuelOps-DR — OCR Engine Factory
 *
 * Dynamic provider selection — reads ocrProvider from SystemSettings at call time.
 * To switch providers: change the setting in /configuracion (no code change needed).
 *
 * Singleton cache per provider name — one instance per process, no redundant allocations.
 *
 * To add a new provider:
 *   1. Implement OCRProvider in lib/ocr/provider.ts
 *   2. Add a case in getOCRProvider() below
 *   3. Add the value to the OcrProvider enum in prisma/schema.prisma
 */

import { OpenAIVisionProvider, GeminiVisionProvider, MockOCRProvider } from "./provider"
import type { OCRProvider } from "./types"

export type { OCRResult, OCRProvider } from "./types"
export type OCRProviderName = "OPENAI" | "GEMINI" | "MOCK"

// Per-name singleton cache
const cache: Partial<Record<OCRProviderName, OCRProvider>> = {}

export function getOCRProvider(name: OCRProviderName): OCRProvider {
  if (cache[name]) return cache[name]!

  let provider: OCRProvider

  switch (name) {
    case "OPENAI": {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error(
        "OPENAI_API_KEY no está configurado.\n" +
        "Agrégalo en Vercel → Settings → Environment Variables → OPENAI_API_KEY"
      )
      provider = new OpenAIVisionProvider(key)
      break
    }

    case "GEMINI": {
      const key = process.env.GEMINI_API_KEY
      if (!key) throw new Error(
        "GEMINI_API_KEY no está configurado.\n" +
        "Agrégalo en Vercel → Settings → Environment Variables → GEMINI_API_KEY"
      )
      provider = new GeminiVisionProvider(key)
      break
    }

    case "MOCK":
    default:
      provider = new MockOCRProvider()
      break
  }

  cache[name] = provider
  return provider
}
