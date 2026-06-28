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
 *
 * Sub-step A: GET /v20.0/{mediaId}  → resolve CDN URL + mime type
 * Sub-step B: GET {cdnUrl}          → download binary bytes
 *
 * Each sub-step has its own try/catch with full diagnostics.
 */
export async function downloadMedia(mediaId: string): Promise<MediaDownload> {
  const { token } = credentials()
  const resolveUrl = `${BASE}/${mediaId}`

  // ── Sub-step A: resolve media metadata ──────────────────────────────────────
  console.log(`[WhatsApp/DL-A] Resolving mediaId=${mediaId}`)
  console.log(`[WhatsApp/DL-A] Endpoint: GET graph.facebook.com/v20.0/${mediaId}`)
  console.log(`[WhatsApp/DL-A] Token: ${token.slice(0, 12)}… (${token.length} chars)`)

  let meta: { url: string; mime_type: string; file_size: number; id: string }

  try {
    const res = await fetch(resolveUrl, {
      headers: { "Authorization": `Bearer ${token}` },
    })

    console.log(`[WhatsApp/DL-A] HTTP ${res.status} ${res.statusText}`)

    const body = await res.text()
    console.log(`[WhatsApp/DL-A] Response body: ${body.slice(0, 500)}`)

    if (!res.ok) {
      throw new Error(
        `[WhatsApp/DL-A] Resolve failed — HTTP ${res.status}: ${body}`
      )
    }

    meta = JSON.parse(body) as typeof meta
    console.log(`[WhatsApp/DL-A] ✅ Resolved: mime=${meta.mime_type} size=${meta.file_size}B`)
  } catch (err) {
    const e = err as Error
    console.error(`[WhatsApp/DL-A] ❌ FAILED`)
    console.error(`[WhatsApp/DL-A] message : ${e.message}`)
    console.error(`[WhatsApp/DL-A] cause   : ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[WhatsApp/DL-A] stack   : ${e.stack ?? "no stack"}`)
    throw e
  }

  // ── Sub-step B: download binary from Meta CDN ────────────────────────────────
  // CDN URL is ephemeral (~5 min). Also requires Bearer token.
  const cdnHost = (() => { try { return new URL(meta.url).hostname } catch { return "unknown-host" } })()
  console.log(`[WhatsApp/DL-B] Downloading from CDN host: ${cdnHost}`)

  let buffer: Buffer

  try {
    const res = await fetch(meta.url, {
      headers: { "Authorization": `Bearer ${token}` },
    })

    console.log(`[WhatsApp/DL-B] HTTP ${res.status} ${res.statusText}`)
    console.log(`[WhatsApp/DL-B] Content-Type: ${res.headers.get("content-type") ?? "unknown"}`)
    console.log(`[WhatsApp/DL-B] Content-Length: ${res.headers.get("content-length") ?? "unknown"}`)

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)")
      throw new Error(
        `[WhatsApp/DL-B] CDN download failed — HTTP ${res.status}: ${body.slice(0, 200)}`
      )
    }

    const ab = await res.arrayBuffer()
    buffer   = Buffer.from(ab)
    console.log(`[WhatsApp/DL-B] ✅ Downloaded ${buffer.length} bytes`)
  } catch (err) {
    const e = err as Error
    console.error(`[WhatsApp/DL-B] ❌ FAILED`)
    console.error(`[WhatsApp/DL-B] message : ${e.message}`)
    console.error(`[WhatsApp/DL-B] cause   : ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[WhatsApp/DL-B] stack   : ${e.stack ?? "no stack"}`)
    throw e
  }

  const ext      = (meta.mime_type.split("/")[1] ?? "jpg").split(";")[0]
  const filename = `${mediaId}.${ext}`

  return { buffer, mimeType: meta.mime_type, filename, fileSize: buffer.length }
}
