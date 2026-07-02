/**
 * FuelOps-DR — WhatsApp caption parser
 *
 * Extracts customer name and truck rótulo from free-form caption text.
 *
 * Accepted formats (case-insensitive, flexible whitespace/punctuation):
 *   Cliente: Hotel X / Camión: H201
 *   cliente:hotel x, camion:H201
 *   POLANCO, rótulo H-211
 *   polanco h211
 *   Polnaco H211          ← fuzzy match happens in resolveCaption, not here
 *   H-211 / Cliente: POLANCO
 *
 * truckCode is always normalized: H-211 → H211, h 211 → H211
 */

export interface ParsedCaption {
  customerName: string | null
  truckCode:    string | null
}

// ─── Labeled patterns ─────────────────────────────────────────────────────────
// "Cliente: POLANCO" or "Cliente POLANCO"
const CUSTOMER_LABEL_RE = /(?:cliente|client)\s*[:\-]?\s*(.+?)(?:\n|\/|,|$)/i

// "Camión: H211", "rótulo: H-211", "rotulo H211"
const TRUCK_LABEL_RE = /(?:camión|camion|c[aá]mion|rotulo|rótulo|truck|unidad)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-]{1,14})/i

// "POLANCO, rótulo H-211"  or  "POLANCO, camion H211"
const FREEFORM_ROTULO_RE = /^(.+?)\s*[,\/]\s*(?:rótulo|rotulo|camión|camion|unidad)\s+([A-Z0-9][A-Z0-9\s\-]{1,14})/i

// Bare truck-code-like token: 1-2 letters + 2-4 digits, optionally with dash/space
// e.g. "H211", "H-211", "C018", "H 211"
const BARE_CODE_RE = /\b([A-Z]{1,2}[\s\-]?\d{2,4})\b/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTruckCode(raw: string): string {
  // Remove any spaces or dashes between the letter prefix and digits
  return raw.replace(/[\s\-]/g, "").toUpperCase()
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCaption(text: string | null): ParsedCaption {
  if (!text || text.trim().length < 2) {
    return { customerName: null, truckCode: null }
  }

  let customerName: string | null = null
  let truckCode:    string | null = null

  // 1. Try labeled patterns first
  const customerLabelMatch = CUSTOMER_LABEL_RE.exec(text)
  if (customerLabelMatch) customerName = customerLabelMatch[1].trim()

  const truckLabelMatch = TRUCK_LABEL_RE.exec(text)
  if (truckLabelMatch) truckCode = normalizeTruckCode(truckLabelMatch[1])

  // 2. If no labeled customer, try "NAME, rótulo CODE"
  if (!customerName || !truckCode) {
    const freeformMatch = FREEFORM_ROTULO_RE.exec(text)
    if (freeformMatch) {
      if (!customerName) customerName = freeformMatch[1].trim()
      if (!truckCode)    truckCode    = normalizeTruckCode(freeformMatch[2])
    }
  }

  // 3. If still no truckCode, look for a bare alphanumeric code (H211, C018…)
  if (!truckCode) {
    const bareMatch = BARE_CODE_RE.exec(text)
    if (bareMatch) truckCode = normalizeTruckCode(bareMatch[1])
  }

  // 4. If no labeled customer but we found a truck code, everything before the
  //    code token (stripped of punctuation) may be the customer name
  if (!customerName && truckCode) {
    const codePos = text.search(BARE_CODE_RE)
    if (codePos > 0) {
      const before = text.slice(0, codePos).replace(/[,\/\-]+$/, "").trim()
      if (before.length >= 2) customerName = before
    }
  }

  return {
    customerName: customerName || null,
    truckCode:    truckCode    || null,
  }
}
