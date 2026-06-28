/**
 * FuelOps-DR — WhatsApp Webhook Parser
 *
 * Converts the raw Meta webhook payload into clean IncomingMessage objects.
 * The route handler and command layer never touch the raw payload.
 */

import type {
  WhatsAppWebhookPayload,
  WhatsAppWebhookValue,
  WhatsAppRawMessage,
  IncomingMessage,
} from "./types"

export function parseWebhookPayload(
  payload: WhatsAppWebhookPayload,
): IncomingMessage[] {
  const result: IncomingMessage[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue

      const value: WhatsAppWebhookValue = change.value
      if (!value.messages?.length) continue

      // Build name lookup from contacts array
      const nameMap: Record<string, string> = {}
      for (const c of value.contacts ?? []) {
        nameMap[c.wa_id] = c.profile.name
      }

      for (const raw of value.messages) {
        result.push(normalise(raw, nameMap, value.metadata.phone_number_id))
      }
    }
  }

  return result
}

function normalise(
  raw:         WhatsAppRawMessage,
  nameMap:     Record<string, string>,
  phoneNumberId: string,
): IncomingMessage {
  const text    = raw.type === "text"  ? (raw as { text: { body: string } }).text?.body  ?? null : null
  const imageId = raw.type === "image" ? (raw as { image: { id: string } }).image?.id    ?? null : null

  return {
    from:          raw.from,
    messageId:     raw.id,
    text,
    imageId,
    type:          raw.type,
    timestamp:     new Date(parseInt(raw.timestamp, 10) * 1000),
    senderName:    nameMap[raw.from] ?? null,
    phoneNumberId,
  }
}
