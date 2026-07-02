/**
 * FuelOps-DR — WhatsApp caption parser
 *
 * Extracts customer name, truck rótulo, and optional payment type
 * from free-form caption text.
 *
 * Accepted formats (case-insensitive, flexible whitespace/punctuation):
 *   Cliente: POLANCO / Camión: H211
 *   cliente:polanco, camion:H-211
 *   POLANCO, rótulo H-211
 *   polanco, H-211, CREDITO      ← full auto-resolve format
 *   polanco h211
 *   H-211 / Cliente: POLANCO
 *
 * truckCode is always normalized: H-211 → H211, h 211 → H211
 * customerName is stripped of trailing punctuation (comma, dash, slash)
 */

export interface ParsedCaption {
  customerName: string | null
  truckCode:    string | null
  paymentType:  "CASH" | "CREDIT" | null
}

// ─── Labeled patterns ─────────────────────────────────────────────────────────
// "Cliente: POLANCO" or "Cliente POLANCO"
const CUSTOMER_LABEL_RE = /(?:cliente|client)\s*[:\-]?\s*(.+?)(?:\n|\/|,|$)/i

// "Camión: H211", "rótulo: H-211", "rotulo H211"
const TRUCK_LABEL_RE = /(?:camión|camion|c[aá]mion|rotulo|rótulo|truck|unidad)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-]{1,14})/i

// "POLANCO, rótulo H-211"  or  "POLANCO, camion H211"
const FREEFORM_ROTULO_RE = /^(.+?)\s*[,\/]\s*(?:rótulo|rotulo|camión|camion|unidad)\s+([A-Z0-9][A-Z0-9\s\-]{1,14})/i

// Bare truck-code-like token: 1-2 letters + dash/space? + 2-4 digits
// e.g. "H211", "H-211", "C018", "H 211"
const BARE_CODE_RE = /\b([A-Z]{1,2}[\-]?\d{2,4})\b/i

// Payment type keywords
const CASH_RE   = /\b(?:efectivo|cash|contado)\b/i
const CREDIT_RE = /\b(?:cr[eé]dito|fiado|fiao|cr[eé]d)\b/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTruckCode(raw: string): string {
  // Remove any spaces or dashes → uppercase
  return raw.replace(/[\s\-]/g, "").toUpperCase()
}

/** Strip trailing punctuation and whitespace from an extracted name segment */
function cleanName(s: string): string {
  // Remove trailing whitespace, commas, slashes, dashes, dots
  return s.replace(/[\s,\/\-\.]+$/, "").trim()
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCaption(text: string | null): ParsedCaption {
  if (!text || text.trim().length < 2) {
    return { customerName: null, truckCode: null, paymentType: null }
  }

  console.log(`[parseCaption] INPUT: "${text}"`)

  let customerName: string | null = null
  let truckCode:    string | null = null

  // ── 1. Labeled patterns ──────────────────────────────────────────────────
  const customerLabelMatch = CUSTOMER_LABEL_RE.exec(text)
  if (customerLabelMatch) {
    customerName = cleanName(customerLabelMatch[1])
    console.log(`[parseCaption] CUSTOMER via label: "${customerName}"`)
  }

  const truckLabelMatch = TRUCK_LABEL_RE.exec(text)
  if (truckLabelMatch) {
    truckCode = normalizeTruckCode(truckLabelMatch[1])
    console.log(`[parseCaption] TRUCK via label: "${truckCode}"`)
  }

  // ── 2. "NAME, rótulo CODE" free-form ────────────────────────────────────
  if (!customerName || !truckCode) {
    const freeformMatch = FREEFORM_ROTULO_RE.exec(text)
    if (freeformMatch) {
      if (!customerName) { customerName = cleanName(freeformMatch[1]); console.log(`[parseCaption] CUSTOMER via freeform-rotulo: "${customerName}"`) }
      if (!truckCode)    { truckCode    = normalizeTruckCode(freeformMatch[2]); console.log(`[parseCaption] TRUCK via freeform-rotulo: "${truckCode}"`) }
    }
  }

  // ── 3. Bare truck code (H211, H-211, C018…) ─────────────────────────────
  if (!truckCode) {
    const bareMatch = BARE_CODE_RE.exec(text)
    if (bareMatch) {
      truckCode = normalizeTruckCode(bareMatch[1])
      console.log(`[parseCaption] TRUCK via bare code: "${truckCode}"`)
    }
  }

  // ── 4. Customer = everything before the truck code ───────────────────────
  if (!customerName && truckCode) {
    const codePos = text.search(BARE_CODE_RE)
    if (codePos > 0) {
      const rawBefore = text.slice(0, codePos)
      // FIX: cleanName strips trailing whitespace AND punctuation (comma, slash, dash)
      // Without this, "polanco, H-211" → slice="polanco, " → trim()="polanco," ← comma survives
      const before = cleanName(rawBefore)
      console.log(`[parseCaption] CUSTOMER from before-code: rawBefore="${rawBefore}" → cleaned="${before}"`)
      if (before.length >= 2) customerName = before
    }
  }

  // ── 5. Payment type keyword anywhere in caption ──────────────────────────
  let paymentType: "CASH" | "CREDIT" | null = null
  if (CREDIT_RE.test(text)) {
    paymentType = "CREDIT"
    console.log(`[parseCaption] PAYMENT: CREDIT`)
  } else if (CASH_RE.test(text)) {
    paymentType = "CASH"
    console.log(`[parseCaption] PAYMENT: CASH`)
  }

  const result = {
    customerName: customerName || null,
    truckCode:    truckCode    || null,
    paymentType,
  }
  console.log(`[parseCaption] RESULT: customer="${result.customerName}" truck="${result.truckCode}" payment="${result.paymentType}"`)
  return result
}
