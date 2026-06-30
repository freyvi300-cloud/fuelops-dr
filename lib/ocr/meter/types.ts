/**
 * FuelOps-DR — Professional Meter OCR Types
 *
 * These types form the contract between the OCR engine and any provider
 * (Gemini, OpenAI Vision, Google Cloud Vision, Azure Vision, etc.).
 *
 * Adding a new provider:
 *   1. Implement MeterOCRProvider
 *   2. Export it from lib/ocr/meter/engine.ts factory
 */

// ─── Stage types ──────────────────────────────────────────────────────────────

export interface PreprocessingMeta {
  originalDimensions: { width: number; height: number; bytes: number }
  enhancedDimensions: { width: number; height: number; bytes: number }
  cropDimensions?:    { width: number; height: number; bytes: number }
  steps:              string[]
}

export interface DetectionStage {
  hasDisplay:  boolean
  displayType: "mechanical" | "digital" | "unknown"
  /** Bounding box in % of image dimensions — provider-agnostic */
  boundingBox: { xPct: number; yPct: number; wPct: number; hPct: number } | null
  notes:       string
  ms:          number
  rawResponse: string
}

export interface ReadingStage {
  readable:     boolean
  gallons:      number | null
  confidence:   number              // 0–100
  imageQuality: "good" | "fair" | "poor"
  notes:        string
  ms:           number
  rawResponse:  string
}

// ─── Final result ─────────────────────────────────────────────────────────────

export interface MeterOCRResult {
  readable:       boolean
  gallons:        number | null
  confidence:     number
  imageQuality:   "good" | "fair" | "poor"
  notes:          string
  provider:       string
  processingMs:   number
  preprocessing:  PreprocessingMeta
  detection:      DetectionStage | null
  reading:        ReadingStage | null
}

// ─── Provider interface ───────────────────────────────────────────────────────
// Implement this interface to add a new OCR provider.

export interface MeterOCRProvider {
  readonly name: string

  /**
   * Stage 1: Locate the meter display within the image.
   * Returns a bounding box in percentage coordinates + meter type.
   * On failure: return { hasDisplay: false } — engine will skip crop.
   */
  detect(image: Buffer): Promise<DetectionStage>

  /**
   * Stage 2: Read the numeric value from the image.
   * Image may be the full photo or a cropped display region.
   * Should always attempt to read even if image quality is poor.
   */
  read(image: Buffer): Promise<ReadingStage>
}
