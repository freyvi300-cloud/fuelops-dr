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
 * startSupplyConversation(phoneNumber, payload, initialState?):
 *   - Called by the image handler after a successful OCR reading
 *   - Creates a WAITING_CONFIRMATION (or WAITING_PAYMENT_TYPE) conversation
 *
 * startPaymentConversation(phoneNumber, payload):
 *   - Called when a payment receipt is detected
 *   - Creates a WAITING_PAYMENT_CUSTOMER conversation
 */

export { getConversation, clearConversation } from "./store"
export type { FlowPayload, SupplyFlowPayload, StoredConversation } from "./types"
export { ConversationState } from "./types"

import { getConversation, setConversation, clearConversation } from "./store"
import { ConversationState, type FlowPayload } from "./types"
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
    const nextPayload: FlowPayload = {
      ...conversation.payload,
      ...result.nextPayload,
    }
    await setConversation(phoneNumber, result.nextState, nextPayload)
  }
  // If neither endConversation nor nextState — stay in current state (re-prompt)

  return result.reply
}

export async function startSupplyConversation(
  phoneNumber:  string,
  payload:      FlowPayload,
  initialState: ConversationState = ConversationState.WAITING_CONFIRMATION,
): Promise<void> {
  await setConversation(phoneNumber, initialState, payload)
  console.log(`[Conversation] Started ${initialState} for ${phoneNumber}`)
}

/** @deprecated Use startSupplyConversation */
export const startConversation = startSupplyConversation

export async function startPaymentConversation(
  phoneNumber: string,
  payload:     FlowPayload,
): Promise<void> {
  await setConversation(phoneNumber, ConversationState.WAITING_PAYMENT_CUSTOMER, payload)
  console.log(`[Conversation] Started WAITING_PAYMENT_CUSTOMER for ${phoneNumber}`)
}
