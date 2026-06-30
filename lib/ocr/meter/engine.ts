/**
 * FuelOps-DR — Professional Meter OCR Engine
 *
 * Optimized two-path pipeline:
 *
 *   Fast path (provider supports analyzeOnce):
 *     Stage 0: Preprocess image
 *     Stage 1: analyzeOnce → detect display + read value in ONE Gemini call
 *     Stage 2: If confidence < REFINE_THRESHOLD AND display found → crop + targeted read
 *              Otherwise → done (1 Gemini call total for high-confidence images)
 *
 *   Standard path (provider without analyzeOnce):
 *     Stage 0: Preprocess
 *     Stage 1: detect() → bounding box
 *     Stage 2: crop + read() → gallon value
 *
 * Graceful degradation:
 *   - Preprocessing fails → use raw input, continue
 *   - Stage 1 fails / no display found → skip crop, use full enhanced image
 *   - Stage 2 read fails → return { readable: false, confidence: 0 }
 *   - HTTP 429 → RateLimitError propagates to caller (commands.ts sends WA message)
 */

import { preprocessImage } from "./preprocessing"
import { GeminiMeterProvider } from "./gemini"
import { isOptimizedProvider, RateLimitError } from "./types"
import type { MeterOCRResult, MeterOCRProvider } from "./types"

// Confidence threshold below which we do a second focused pass on the cropped display.
// Separate from ocrMinConfidence (user-configurable WA reply tier).
const REFINE_THRESHOLD = 85

// ─── Engine options ───────────────────────────────────────────────────────────

export interface EngineOptions {
  provider?:   MeterOCRProvider
  skipDetect?: boolean
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function resolveProvider(override?: MeterOCRProvider): MeterOCRProvider {
  if (override) return override
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error(
    "GEMINI_API_KEY no está configurado en Vercel → Settings → Environment Variables"
  )
  return new GeminiMeterProvider(apiKey)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function analyzeMeter(
  input: Buffer,
  opts:  EngineOptions = {},
): Promise<MeterOCRResult> {
  const t0 = Date.now()
  console.log(`[OCR] ═══════════════════════════════════════════`)
  console.log(`[OCR] START analyzeMeter | input=${input.length}B`)

  const provider = resolveProvider(opts.provider)
  console.log(`[OCR] Provider: ${provider.name} | oneShot=${isOptimizedProvider(provider)}`)

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

  // ── Optimized path: analyzeOnce (detect + read in one Gemini call) ────────

  if (isOptimizedProvider(provider) && !opts.skipDetect) {
    console.log(`[OCR] Stage 1+2: OneShot (detect+read combined)`)
    const { detection, reading } = await provider.analyzeOnce(prep.enhanced)
    // RateLimitError propagates up from here

    console.log(
      `[OCR] OneShot: readable=${reading.readable} gallons=${reading.gallons} ` +
      `confidence=${reading.confidence}% bbox=${detection.boundingBox ? "yes" : "no"}`
    )

    // High confidence OR no bbox → done (1 Gemini call total)
    if (reading.confidence >= REFINE_THRESHOLD || !detection.boundingBox) {
      if (reading.confidence >= REFINE_THRESHOLD) {
        console.log(`[OCR] Confidence ${reading.confidence}% ≥ ${REFINE_THRESHOLD}% — skipping refinement`)
      } else {
        console.log(`[OCR] No display bbox — skipping refinement`)
      }

      const totalMs = Date.now() - t0
      console.log(`[OCR] DONE ${totalMs}ms (1 Gemini call)`)
      console.log(`[OCR] ═══════════════════════════════════════════`)
      return {
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
    }

    // Low confidence + display found → refinement pass on cropped region
    console.log(
      `[OCR] Confidence ${reading.confidence}% < ${REFINE_THRESHOLD}% — refinement pass on cropped display`
    )

    let imageForReading = prep.enhanced

    try {
      const cropped = await preprocessImage(prep.enhanced, detection.boundingBox)
      cropped.meta.steps.forEach(s => console.log(s))
      if (cropped.displayCrop) {
        imageForReading = cropped.displayCrop
        console.log(`[OCR] Refinement: cropped display ready — ${imageForReading.length}B`)
      }
    } catch (cropErr) {
      console.error(`[OCR] Refinement: crop failed — ${(cropErr as Error).message} — using full enhanced`)
    }

    console.log(`[OCR] Stage 2 (refinement read) | image=${imageForReading.length}B`)
    const refinedReading = await provider.read(imageForReading)
    // RateLimitError propagates from here too

    const totalMs = Date.now() - t0
    console.log(
      `[OCR] Refinement: readable=${refinedReading.readable} gallons=${refinedReading.gallons} ` +
      `confidence=${refinedReading.confidence}%`
    )
    console.log(`[OCR] DONE ${totalMs}ms (2 Gemini calls — refinement needed)`)
    console.log(`[OCR] ═══════════════════════════════════════════`)

    return {
      readable:      refinedReading.readable && refinedReading.gallons !== null,
      gallons:       refinedReading.gallons,
      confidence:    refinedReading.confidence,
      imageQuality:  refinedReading.imageQuality,
      notes:         refinedReading.notes,
      provider:      provider.name,
      processingMs:  totalMs,
      preprocessing: prep.meta,
      detection,
      reading:       refinedReading,
    }
  }

  // ── Standard path: separate detect → crop → read ──────────────────────────

  let imageForReading = prep.enhanced
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

  console.log(`[OCR] Stage 2: Read meter | image=${imageForReading.length}B`)
  const reading = await provider.read(imageForReading)

  const totalMs = Date.now() - t0
  console.log(
    `[OCR] Stage 2: readable=${reading.readable} gallons=${reading.gallons} ` +
    `confidence=${reading.confidence}% quality=${reading.imageQuality}`
  )
  console.log(`[OCR] DONE ${totalMs}ms`)
  console.log(`[OCR] ═══════════════════════════════════════════`)

  return {
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
}

export { RateLimitError }
