/**
 * FuelOps-DR — WhatsApp Cloud API Types
 * Based on Meta's webhook payload format (v20.0+)
 */

// ─── Incoming webhook payload ─────────────────────────────────────────────────

export interface WhatsAppContact {
  profile: { name: string }
  wa_id:   string              // sender's WhatsApp number (no +)
}

export interface WhatsAppTextMessage {
  from:      string
  id:        string
  timestamp: string            // Unix epoch string
  type:      "text"
  text:      { body: string }
}

export interface WhatsAppImageMessage {
  from:      string
  id:        string
  timestamp: string
  type:      "image"
  image: {
    id:        string          // media ID — fetch separately to get image bytes
    mime_type: string
    sha256:    string
    caption?:  string
  }
}

export interface WhatsAppAudioMessage {
  from:      string
  id:        string
  timestamp: string
  type:      "audio"
  audio:     { id: string; mime_type: string }
}

export interface WhatsAppUnknownMessage {
  from:      string
  id:        string
  timestamp: string
  type:      string            // document, sticker, video, location, etc.
}

export type WhatsAppRawMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppUnknownMessage

export interface WhatsAppStatus {
  id:           string
  status:       "sent" | "delivered" | "read" | "failed"
  timestamp:    string
  recipient_id: string
  errors?:      Array<{ code: number; title: string }>
}

export interface WhatsAppWebhookValue {
  messaging_product: "whatsapp"
  metadata: {
    display_phone_number: string
    phone_number_id:      string
  }
  contacts?:  WhatsAppContact[]
  messages?:  WhatsAppRawMessage[]
  statuses?:  WhatsAppStatus[]
}

export interface WhatsAppWebhookEntry {
  id:      string
  changes: Array<{
    value: WhatsAppWebhookValue
    field: string                // "messages" | "message_template_status_update"
  }>
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account"
  entry:  WhatsAppWebhookEntry[]
}

// ─── Normalised internal type ─────────────────────────────────────────────────

/** Clean representation after parsing the raw webhook payload */
export interface IncomingMessage {
  from:        string       // sender phone (without +)
  messageId:   string
  text:        string | null  // null for non-text types
  imageId:     string | null  // media ID if type === "image" (for future OCR)
  type:        string
  timestamp:   Date
  senderName:  string | null
  phoneNumberId: string     // which of our numbers received the message
}

// ─── Send API ─────────────────────────────────────────────────────────────────

export interface SendTextPayload {
  messaging_product: "whatsapp"
  to:               string
  type:             "text"
  text:             { body: string; preview_url?: boolean }
}

export interface SendReadReceiptPayload {
  messaging_product: "whatsapp"
  status:            "read"
  message_id:        string
}
