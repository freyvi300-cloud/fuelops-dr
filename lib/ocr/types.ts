/**
 * FuelOps-DR — OCR Engine Types
 *
 * Shared contract between the supply form (consumer) and any OCR provider.
 * The form only knows about OCRResult — never about which provider is running.
 */

export interface OCRResult {
  /** Galones detectados, null si la imagen no es legible */
  gallons:      number | null
  /** Nivel de confianza 0-100 */
  confidence:   number
  /** Texto raw devuelto por el proveedor (para debug) */
  rawText:      string
  /** Identificador del proveedor usado: "openai/gpt-4o-mini", "gemini/flash", etc. */
  provider:     string
  /** Milliseconds de procesamiento end-to-end */
  processingMs: number
}

/**
 * Interfaz que debe implementar cualquier proveedor OCR.
 * Para cambiar de OpenAI a Gemini, Google Vision, Claude, etc.:
 *   1. Crear una nueva clase que implemente OCRProvider
 *   2. Registrarla en lib/ocr/index.ts
 *   3. Cero cambios en el resto del proyecto
 */
export interface OCRProvider {
  readMeter(image: Buffer): Promise<OCRResult>
}
