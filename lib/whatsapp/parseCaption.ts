/**
 * FuelOps-DR — WhatsApp caption parser
 *
 * Extracts "Cliente: X" and "Camión: Y" (or "Rótulo: Y") from
 * a free-form caption sent alongside a meter image.
 *
 * Accepted formats (case-insensitive, flexible whitespace):
 *   Cliente: Hotel X\nCamión: H201
 *   cliente:hotel x / camion:H201
 *   Cliente: Hotel X, Camión: H201
 *   Camión H201 - Cliente Hotel X
 */

export interface ParsedCaption {
  customerName: string | null
  truckCode:    string | null
}

// Patterns for "label: value" style
const CUSTOMER_RE = /cliente\s*[:\-]\s*(.+?)(?:\n|\/|,|$)/i
const TRUCK_RE    = /(?:camión|camion|rotulo|rótulo|camion|truck)\s*[:\-]?\s*([A-Z0-9\-]{2,12})/i

export function parseCaption(text: string | null): ParsedCaption {
  if (!text || text.trim().length < 3) {
    return { customerName: null, truckCode: null }
  }

  const customerMatch = CUSTOMER_RE.exec(text)
  const truckMatch    = TRUCK_RE.exec(text)

  return {
    customerName: customerMatch?.[1]?.trim() ?? null,
    truckCode:    truckMatch?.[1]?.trim().toUpperCase() ?? null,
  }
}
