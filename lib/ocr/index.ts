/**
 * FuelOps-DR — OCR Engine Entry Point
 *
 * Singleton factory. Only one provider instance is created per server process.
 * To switch providers: change the instantiation in getOCRProvider() below.
 *
 * Available providers (create the class first, then register here):
 *   OpenAIVisionProvider    ← current
 *   GeminiOCRProvider       ← future
 *   AzureVisionProvider     ← future
 *   GoogleVisionProvider    ← future
 *   ClaudeVisionProvider    ← future
 *   MockOCRProvider         ← for testing
 */

import { OpenAIVisionProvider } from "./provider"
import type { OCRProvider }     from "./types"

export type { OCRResult, OCRProvider } from "./types"

let _provider: OCRProvider | null = null

export function getOCRProvider(): OCRProvider {
  if (_provider) return _provider

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      "OCR no configurado: OPENAI_API_KEY no está definido.\n" +
      "Agrega OPENAI_API_KEY en:\n" +
      "  • Local: archivo .env\n" +
      "  • Producción: Vercel → Settings → Environment Variables"
    )
  }

  // ← swap this line to change provider globally
  _provider = new OpenAIVisionProvider(apiKey)
  return _provider
}
