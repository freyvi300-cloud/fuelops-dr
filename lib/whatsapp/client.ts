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

// ─── Download media ───────────────────────────────────────────────────────────

export interface MediaDownload {
  buffer:   Buffer
  mimeType: string   // "image/jpeg", "image/png", etc.
  filename: string   // "{mediaId}.jpg"
  fileSize: number   // bytes
}

/**
 * Downloads an image (or any media) from WhatsApp Cloud API.
 * Two-step: first GET /{mediaId} to get the CDN URL, then GET that URL.
 * Both requests require the Bearer token.
 */
export async function downloadMedia(mediaId: string): Promise<MediaDownload> {
  const { token } = credentials()

  // Step 1 — resolve media URL from media ID
  console.log(`[WhatsApp] downloadMedia: resolving id=${mediaId}`)
  const metaRes = await fetch(`${BASE}/${mediaId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  })
  if (!metaRes.ok) {
    const err = await metaRes.text().catch(() => "unknown")
    throw new Error(`WhatsApp media resolve ${metaRes.status}: ${err}`)
  }
  const meta = await metaRes.json() as {
    url:       string
    mime_type: string
    file_size: number
    sha256:    string
    id:        string
  }
  console.log(`[WhatsApp] downloadMedia: mime=${meta.mime_type} size=${meta.file_size}B url=...`)

  // Step 2 — download the actual file from CDN
  const imgRes = await fetch(meta.url, {
    headers: { "Authorization": `Bearer ${token}` },
  })
  if (!imgRes.ok) {
    throw new Error(`WhatsApp CDN download ${imgRes.status}`)
  }
  const arrayBuffer = await imgRes.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)
  console.log(`[WhatsApp] downloadMedia: downloaded ${buffer.length} bytes ✅`)

  const ext      = (meta.mime_type.split("/")[1] ?? "jpg").split(";")[0]
  const filename = `${mediaId}.${ext}`

  return { buffer, mimeType: meta.mime_type, filename, fileSize: buffer.length }
}
