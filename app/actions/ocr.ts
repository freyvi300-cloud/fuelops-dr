"use server"

import { getOCRProvider } from "@/lib/ocr"
import type { OCRResult } from "@/lib/ocr"

export type { OCRResult }

const MAX_IMAGE_BYTES = 4 * 1024 * 1024  // 4 MB (base64 ≈ 1.33× raw)

/**
 * Analyzes a fuel meter photo and returns structured OCR data.
 *
 * @param imageBase64 - base64 image (with or without data-URL prefix)
 * @returns OCRResult — the form only consumes this, never the provider
 */
export async function analyzeMeterPhoto(imageBase64: string): Promise<OCRResult> {
  // Strip data-URL prefix: "data:image/jpeg;base64,..."
  const raw    = imageBase64.replace(/^data:[^;]+;base64,/, "")
  const buffer = Buffer.from(raw, "base64")

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Imagen demasiado grande (${(buffer.length / 1024 / 1024).toFixed(1)} MB). ` +
      "Máximo permitido: 4 MB."
    )
  }

  const provider = getOCRProvider()
  return provider.readMeter(buffer)
}
