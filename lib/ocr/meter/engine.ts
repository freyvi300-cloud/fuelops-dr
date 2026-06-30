/**
 * FuelOps-DR — Professional Meter OCR Engine
 *
 * Two-stage OCR pipeline with image preprocessing:
 *
 *   Stage 0: Preprocess (sharp — upscale 2×, normalize, sharpen)
 *   Stage 1: Detect    (provider.detect → find display bounding box)
 *   Stage 2: Crop      (sharp — extract + enhance display region)
 *   Stage 3: Read      (provider.read → extract gallon value)
 *
 * The engine is provider-agnostic: swap out GeminiMeterProvider for
 * OpenAIVisionProvider / GoogleCloudVisionProvider / AzureVisionProvider
 * by implementing the MeterOCRProvider interface (lib/ocr/meter/types.ts).
 *
 * Graceful degradation:
 *   - Preprocessing fails → use raw input, continue
 *   - Stage 1 fails / no display found → skip crop, use full enhanced image
 *   - Stage 2 read fails → return { readable: false, confidence: 0 }
 */

import { preprocessImage } from "./preprocessing"
import { GeminiMeterProvider } from "./gemini"
import type { MeterOCRResult, MeterOCRProvider } from "./types"

// ─── Engine options ───────────────────────────────────────────────────────────

export interface EngineOptions {
  /** Override the default Gemini provider */
  provider?:   MeterOCRProvider
  /** Skip Stage 1 (detection) and use the full enhanced image for reading */
  skipDetect?: boolean
}

// ─── Factory: resolve the active provider ────────────────────────────────────

function resolveProvider(override?: MeterOCRProvider): MeterOCRProvider {
  if (override) return override

  // Default: Gemini — extend here to read ocrProvider from SystemSettings
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error(
    "GEMINI_API_KEY no está configurado en Vercel → Settings → Environment Variables"
  )
  return new GeminiMeterProvider(apiKey)
}

// ─── Main engine entry point ──────────────────────────────────────────────────

export async function analyzeMeter(
  input: Buffer,
  opts:  EngineOptions = {},
): Promise<MeterOCRResult> {
  const t0 = Date.now()
  console.log(`[OCR] ═══════════════════════════════════════════`)
  console.log(`[OCR] START analyzeMeter | input=${input.length}B`)

  const provider = resolveProvider(opts.provider)
  console.log(`[OCR] Provider: ${provider.name}`)

  // ── Stage 0: Preprocessing ────────────────────────────────────────────────

  console.log(`[OCR] Stage 0: Preprocessing`)
  let prep: Awaited<ReturnType<typeof preprocessImage>>

  try {
    prep = await preprocessImage(input)
    prep.meta.steps.forEach(s => console.log(s))
  } catch (err) {
    console.error(`[OCR] Stage 0 FAILED: ${(err as Error).message} — using raw input`)
    prep = {
      original: input, enhanced: input, displayCrop: null,
      meta: {
        originalDimensions: { width: 0, height: 0, bytes: input.length },
        enhancedDimensions: { width: 0, height: 0, bytes: input.length },
        steps: [`[PRE] FAILED: ${(err as Error).message}`],
      },
    }
  }

  let imageForReading = prep.enhanced

  // ── Stage 1: Display detection ────────────────────────────────────────────

  let detection: MeterOCRResult["detection"] = null

  if (!opts.skipDetect) {
    console.log(`[OCR] Stage 1: Detect display in ${prep.enhanced.length}B enhanced image`)
    detection = await provider.detect(prep.enhanced)

    if (detection.hasDisplay && detection.boundingBox) {
      console.log(`[OCR] Stage 1: Display found — cropping to bbox`)
      try {
        const cropped = await preprocessImage(prep.enhanced, detection.boundingBox)
        cropped.meta.steps.forEach(s => console.log(s))
        if (cropped.displayCrop) {
          imageForReading = cropped.displayCrop
          console.log(`[OCR] Stage 1: Cropped display ready — ${imageForReading.length}B`)
        } else {
          console.warn(`[OCR] Stage 1: Crop returned null — using full enhanced image`)
        }
      } catch (cropErr) {
        console.error(`[OCR] Stage 1: Crop failed — ${(cropErr as Error).message} — using full enhanced`)
      }
    } else {
      console.log(`[OCR] Stage 1: No display detected — using full enhanced image`)
    }
  } else {
    console.log(`[OCR] Stage 1: SKIPPED (skipDetect=true)`)
  }

  // ── Stage 2: Read meter value ─────────────────────────────────────────────

  console.log(`[OCR] Stage 2: Read meter | image=${imageForReading.length}B`)
  const reading = await provider.read(imageForReading)

  // ── Final result ──────────────────────────────────────────────────────────

  const totalMs = Date.now() - t0
  const result: MeterOCRResult = {
    readable:      reading.readable && reading.gallons !== null,
    gallons:       reading.gallons,
    confidence:    reading.confidence,
    imageQuality:  reading.imageQuality,
    notes:         reading.notes,
    provider:      provider.name,
    processingMs:  totalMs,
    preprocessing: prep.meta,
    detection,
    reading,
  }

  console.log(
    `[OCR] Stage 2: readable=${result.readable} gallons=${result.gallons} ` +
    `confidence=${result.confidence}% quality=${result.imageQuality}`
  )
  console.log(`[OCR] DONE ${totalMs}ms`)
  console.log(`[OCR] ═══════════════════════════════════════════`)

  return result
}
