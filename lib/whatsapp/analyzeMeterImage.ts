/**
 * FuelOps-DR — WhatsApp → Professional OCR Bridge (Phase 3.2+)
 *
 * This file is a thin adaptor between the WhatsApp image pipeline and the
 * professional meter OCR engine (lib/ocr/meter/engine.ts).
 *
 * It converts MeterOCRResult (internal English types) to MeterAnalysisResult
 * (Spanish quality labels) so commands.ts stays unchanged.
 *
 * To switch OCR provider: edit lib/ocr/meter/engine.ts — this file never changes.
 */

import { analyzeMeter } from "@/lib/ocr/meter/engine"

// ─── Public type (used by commands.ts + media.ts) ─────────────────────────────

export interface MeterAnalysisResult {
  gallons:      number | null
  confidence:   number              // 0–100
  imageQuality: "buena" | "regular" | "mala"
  notes:        string
  provider:     string
  processingMs: number
  rawText:      string              // raw Gemini JSON — stored in DB for debugging
}

// ─── Quality mapping (internal English → Spanish for DB/WA) ──────────────────

const QUALITY: Record<string, "buena" | "regular" | "mala"> = {
  good: "buena",
  fair: "regular",
  poor: "mala",
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function analyzeMeterImage(buffer: Buffer): Promise<MeterAnalysisResult> {
  const result = await analyzeMeter(buffer)

  return {
    gallons:      result.gallons,
    confidence:   result.confidence,
    imageQuality: QUALITY[result.imageQuality] ?? "mala",
    notes:        result.notes,
    provider:     result.provider,
    processingMs: result.processingMs,
    rawText:      result.reading?.rawResponse ?? "",
  }
}
