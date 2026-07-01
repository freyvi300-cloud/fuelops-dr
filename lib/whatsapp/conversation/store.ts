/**
 * FuelOps-DR — Conversation Store
 *
 * Persists WhatsApp conversation state to Postgres via Prisma.
 * Conversations expire after TTL_MS to prevent stale state.
 *
 * Public API:
 *   getConversation(phoneNumber)           — null if none / expired
 *   setConversation(phoneNumber, state, payload) — upsert
 *   clearConversation(phoneNumber)         — delete (end of flow)
 */

import { prisma } from "@/lib/prisma"
import type { ConversationState, SupplyFlowPayload, StoredConversation } from "./types"

// Conversations expire 30 minutes after the last message
const TTL_MS = 30 * 60 * 1000

export async function getConversation(
  phoneNumber: string,
): Promise<StoredConversation | null> {
  const row = await prisma.whatsAppConversation.findUnique({
    where: { phoneNumber },
  })

  if (!row) return null

  // Expire silently — next message will start fresh
  if (row.expiresAt < new Date()) {
    console.log(`[Conversation] Expired conversation for ${phoneNumber} — clearing`)
    await prisma.whatsAppConversation
      .delete({ where: { phoneNumber } })
      .catch(() => {})
    return null
  }

  return {
    id:          row.id,
    phoneNumber: row.phoneNumber,
    state:       row.state as ConversationState,
    payload:     row.payload as unknown as SupplyFlowPayload,
    expiresAt:   row.expiresAt,
  }
}

export async function setConversation(
  phoneNumber: string,
  state:       ConversationState,
  payload:     SupplyFlowPayload,
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS)

  // Prisma Json columns require InputJsonValue — cast through unknown
  const jsonPayload = payload as unknown as Parameters<
    typeof prisma.whatsAppConversation.create
  >[0]["data"]["payload"]

  await prisma.whatsAppConversation.upsert({
    where:  { phoneNumber },
    create: { phoneNumber, state, payload: jsonPayload, expiresAt },
    update: { state, payload: jsonPayload, expiresAt },
  })

  console.log(`[Conversation] ${phoneNumber} → state=${state} expires=${expiresAt.toISOString()}`)
}

export async function clearConversation(phoneNumber: string): Promise<void> {
  await prisma.whatsAppConversation
    .delete({ where: { phoneNumber } })
    .catch(() => {})  // ignore if already gone
  console.log(`[Conversation] ${phoneNumber} → cleared`)
}
