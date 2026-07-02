/**
 * FuelOps-DR — WhatsApp image classifier
 *
 * Uses Gemini Vision to classify a received image as:
 *   "meter"   — fuel meter / counter display
 *   "receipt" — bank transfer / payment receipt
 *   "unknown" — neither (document, photo, etc.)
 *
 * For "receipt" images it also extracts payment data in the same call
 * to avoid a double round-trip to the model.
 *
 * Throws if GEMINI_API_KEY is not set or the API call fails.
 */

import { RateLimitError } from "@/lib/ocr/meter/types"

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

export interface ReceiptData {
  amount:    number | null   // numeric amount in RD$ or USD
  currency:  string | null   // "RD$" | "USD" | null
  bank:      string | null   // name of bank (BanReservas, BHD, Banesco, etc.)
  reference: string | null   // transfer / confirmation number
  date:      string | null   // ISO date string YYYY-MM-DD or null
  emitter:   string | null   // sender name if visible
}

export type ImageType = "meter" | "receipt" | "unknown"

export interface ClassifyResult {
  type:    ImageType
  receipt: ReceiptData | null   // only set when type === "receipt"
}

const CLASSIFY_PROMPT = `Analyze this image and determine what it shows.

Return a JSON object with this exact structure:
{
  "type": "meter" | "receipt" | "unknown",
  "amount": number | null,
  "currency": "RD$" | "USD" | null,
  "bank": string | null,
  "reference": string | null,
  "date": "YYYY-MM-DD" | null,
  "emitter": string | null
}

Rules:
- "meter": the image shows a mechanical or digital fuel meter / flow counter with numerical digits
- "receipt": the image shows a bank transfer receipt, payment confirmation, deposit voucher, or similar financial document
- "unknown": anything else

For "receipt" type, extract:
- amount: the transfer/payment amount as a plain number (no currency symbols)
- currency: "RD$" if Dominican Pesos, "USD" if US Dollars, null if unclear
- bank: the bank name (BanReservas, BHD, Banesco, Scotiabank, Popular, etc.)
- reference: the confirmation / reference number
- date: the transaction date in YYYY-MM-DD format
- emitter: the sender's name if visible, null otherwise

For non-receipt types, set all receipt fields to null.
Return ONLY the JSON object with no markdown, no explanation.`

export async function classifyImage(buffer: Buffer): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  const b64 = buffer.toString("base64")

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: CLASSIFY_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: b64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens:  512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch (err) {
    throw new Error(`Gemini classify request failed: ${(err as Error).message}`)
  }

  if (res.status === 429) throw new RateLimitError("gemini", "classify", 1)
  if (!res.ok) throw new Error(`Gemini classify HTTP ${res.status}`)

  const json = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  let parsed: Record<string, unknown>
  try {
    // Strip markdown fences if present
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
    parsed = JSON.parse(clean)
  } catch {
    console.warn("[classifyImage] Failed to parse Gemini response:", text.slice(0, 200))
    return { type: "unknown", receipt: null }
  }

  const type = (parsed.type as string) === "meter"   ? "meter"
             : (parsed.type as string) === "receipt" ? "receipt"
             : "unknown"

  if (type !== "receipt") return { type, receipt: null }

  return {
    type,
    receipt: {
      amount:    typeof parsed.amount === "number" ? parsed.amount : null,
      currency:  typeof parsed.currency === "string" ? parsed.currency : null,
      bank:      typeof parsed.bank === "string" ? parsed.bank : null,
      reference: typeof parsed.reference === "string" ? parsed.reference : null,
      date:      typeof parsed.date === "string" ? parsed.date : null,
      emitter:   typeof parsed.emitter === "string" ? parsed.emitter : null,
    },
  }
}
