"use server"

import { getOCRProvider }    from "@/lib/ocr"
import { getSystemSettings } from "@/lib/system-settings"
import type { OCRResult }    from "@/lib/ocr"
import type { OCRProviderName } from "@/lib/ocr"

export type { OCRResult }

const MAX_IMAGE_BYTES = 4 * 1024 * 1024   // 4 MB

/**
 * Analyzes a fuel meter photo using the active OCR provider (from SystemSettings).
 * Provider selection: OPENAI → GEMINI → MOCK — changed via /configuracion, no code change needed.
 */
export async function analyzeMeterPhoto(imageBase64: string): Promise<OCRResult> {
  // Fetch settings to determine active provider
  const settings = await getSystemSettings()

  const raw    = imageBase64.replace(/^data:[^;]+;base64,/, "")
  const buffer = Buffer.from(raw, "base64")

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Imagen demasiado grande (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Máximo: 4 MB.`
    )
  }

  const provider = getOCRProvider(settings.ocrProvider as OCRProviderName)
  return provider.readMeter(buffer)
}
