/**
 * FuelOps-DR — Image Preprocessing for Meter OCR
 *
 * Enhances fuel meter photos before sending to any OCR provider.
 * Uses sharp (libvips) — fast, Vercel-compatible, no external service needed.
 *
 * Pipeline:
 *   1. Upscale 2× (max 2000px) with lanczos3 for sub-pixel sharpness
 *   2. normalize() — auto-adjusts contrast and brightness channel by channel
 *   3. sharpen()   — accentuates display digit edges
 *   4. Optional crop to display bounding box (from Stage 1 detection)
 *      + additional sharpen pass on the cropped region
 */

import sharp from "sharp"
import type { PreprocessingMeta } from "./types"

export interface PreprocessingResult {
  original:    Buffer
  enhanced:    Buffer
  displayCrop: Buffer | null
  meta:        PreprocessingMeta
}

export async function preprocessImage(
  input:   Buffer,
  cropBox: { xPct: number; yPct: number; wPct: number; hPct: number } | null = null,
): Promise<PreprocessingResult> {
  const steps: string[] = []

  // ── Step 1: Inspect original ──────────────────────────────────────────────
  const origMeta = await sharp(input).metadata()
  const origW    = origMeta.width  ?? 800
  const origH    = origMeta.height ?? 600
  steps.push(`[PRE] Original: ${origW}×${origH} ${origMeta.format ?? "?"} ${input.length}B`)

  // ── Step 2: Upscale + enhance ─────────────────────────────────────────────
  // Target: 2× the original, capped at 2000px wide (Gemini handles up to 4096px
  // but 2000px is sweet spot for speed vs. accuracy on meter displays).
  const targetW = Math.min(origW * 2, 2000)

  const enhanced = await sharp(input)
    .resize(targetW, null, {
      fit:                "inside",
      withoutEnlargement: false,
      kernel:             sharp.kernel.lanczos3,  // highest quality upscale
    })
    .normalize()                                    // auto contrast + brightness
    .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })   // edge sharpening
    .jpeg({ quality: 95 })
    .toBuffer()

  const enhMeta = await sharp(enhanced).metadata()
  const enhW    = enhMeta.width  ?? targetW
  const enhH    = enhMeta.height ?? 0
  steps.push(`[PRE] Enhanced: ${enhW}×${enhH} (2× lanczos3 + normalize + sharpen) ${enhanced.length}B`)

  // ── Step 3: Optional display crop ─────────────────────────────────────────
  let displayCrop: Buffer | null = null

  if (cropBox) {
    try {
      // Add 6% padding so we don't clip digit edges
      const PAD    = 0.06
      const left   = Math.max(0, Math.round((cropBox.xPct / 100 - PAD) * enhW))
      const top    = Math.max(0, Math.round((cropBox.yPct / 100 - PAD) * enhH))
      const right  = Math.min(enhW, Math.round(((cropBox.xPct + cropBox.wPct) / 100 + PAD) * enhW))
      const bottom = Math.min(enhH, Math.round(((cropBox.yPct + cropBox.hPct) / 100 + PAD) * enhH))
      const width  = right - left
      const height = bottom - top

      if (width > 30 && height > 15) {
        // Extra enhancement pass on the cropped region
        const cropW = Math.min(width * 2, 1000)
        displayCrop = await sharp(enhanced)
          .extract({ left, top, width, height })
          .resize(cropW, null, { kernel: sharp.kernel.lanczos3 })
          .normalize()
          .sharpen({ sigma: 1.8, m1: 2.0, m2: 0.5 })  // more aggressive for small displays
          .jpeg({ quality: 98 })
          .toBuffer()

        const cropMeta = await sharp(displayCrop).metadata()
        steps.push(
          `[PRE] Cropped display: box=[${left},${top} ${width}×${height}] → ` +
          `${cropMeta.width}×${cropMeta.height} ${displayCrop.length}B`
        )
      } else {
        steps.push(`[PRE] Crop box too small (${width}×${height}) — skipping crop`)
      }
    } catch (err) {
      steps.push(`[PRE] Crop FAILED: ${(err as Error).message} — using full enhanced`)
    }
  }

  const cropMeta = displayCrop ? await sharp(displayCrop).metadata() : null

  return {
    original: input,
    enhanced,
    displayCrop,
    meta: {
      originalDimensions: { width: origW, height: origH, bytes: input.length },
      enhancedDimensions: { width: enhW,  height: enhH,  bytes: enhanced.length },
      ...(cropMeta ? {
        cropDimensions: {
          width:  cropMeta.width  ?? 0,
          height: cropMeta.height ?? 0,
          bytes:  displayCrop!.length,
        },
      } : {}),
      steps,
    },
  }
}
