/**
 * FuelOps-DR — Conversation Public API
 *
 * processConversation(phoneNumber, rawMessage):
 *   - Loads the active conversation from DB
 *   - Dispatches to the correct state handler
 *   - Persists the new state (or clears on end)
 *   - Returns the reply text to send to the user
 *   - Returns null if no active conversation exists (caller handles as normal command)
 *
 * startConversation(phoneNumber, payload):
 *   - Called by the image handler after a successful OCR reading
 *   - Creates a WAITING_CONFIRMATION conversation
 */

export { getConversation, clearConversation } from "./store"
export type { SupplyFlowPayload, StoredConversation } from "./types"
export { ConversationState } from "./types"

import { getConversation, setConversation, clearConversation } from "./store"
import { ConversationState, type SupplyFlowPayload } from "./types"
import { dispatch } from "./machine"

export async function processConversation(
  phoneNumber: string,
  rawMessage:  string,
): Promise<string | null> {
  const conversation = await getConversation(phoneNumber)
  if (!conversation) return null   // no active conversation — caller handles as command

  const message = rawMessage.toLowerCase().trim()

  const ctx = { phoneNumber, message, rawMessage, conversation }
  const result = await dispatch(ctx)

  if (result.endConversation) {
    await clearConversation(phoneNumber)
  } else if (result.nextState) {
    // Merge nextPayload into current payload and transition
    const nextPayload: SupplyFlowPayload = {
      ...conversation.payload,
      ...result.nextPayload,
    }
    await setConversation(phoneNumber, result.nextState, nextPayload)
  }
  // If neither endConversation nor nextState — stay in current state (re-prompt)

  return result.reply
}

export async function startConversation(
  phoneNumber: string,
  payload:     SupplyFlowPayload,
): Promise<void> {
  await setConversation(phoneNumber, ConversationState.WAITING_CONFIRMATION, payload)
  console.log(`[Conversation] Started WAITING_CONFIRMATION for ${phoneNumber}`)
}
