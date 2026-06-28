/**
 * FuelOps-DR — WhatsApp Cloud API Client
 *
 * Thin wrapper around the Meta Graph API.
 * All outbound messages go through sendTextMessage().
 *
 * Future additions (same pattern):
 *   sendTemplateMessage() — for proactive notifications (receipts, alerts)
 *   sendMediaMessage()    — for PDF receipts, images
 *   downloadMedia()       — to get image bytes for OCR
 */

const API_VERSION = "v20.0"
const BASE        = `https://graph.facebook.com/${API_VERSION}`

function credentials(): { phoneId: string; token: string } {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token   = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneId || !token) {
    throw new Error(
      "WhatsApp no configurado. Agrega WHATSAPP_PHONE_NUMBER_ID y " +
      "WHATSAPP_ACCESS_TOKEN en Vercel → Settings → Environment Variables."
    )
  }
  return { phoneId, token }
}

// ─── Send text message ────────────────────────────────────────────────────────

export async function sendTextMessage(to: string, body: string): Promise<string | null> {
  const { phoneId, token } = credentials()

  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown")
    throw new Error(`WhatsApp API ${res.status}: ${err}`)
  }

  const data = await res.json() as { messages?: Array<{ id: string }> }
  const msgId = data.messages?.[0]?.id ?? null
  console.log(`[WhatsApp] Sent to ${to}: msgId=${msgId}`)
  return msgId
}

// ─── Mark as read ─────────────────────────────────────────────────────────────

export async function markMessageAsRead(messageId: string): Promise<void> {
  let phoneId: string, token: string
  try { ({ phoneId, token } = credentials()) } catch { return }

  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status:            "read",
      message_id:        messageId,
    }),
  })

  if (!res.ok) {
    console.warn(`[WhatsApp] markAsRead failed for ${messageId}: ${res.status}`)
  }
}

// ─── Download media (future: OCR) ─────────────────────────────────────────────

/**
 * TODO Phase 3: download image from WhatsApp and pass to OCR
 * export async function downloadMedia(mediaId: string): Promise<Buffer> { ... }
 */
