/**
 * State: WAITING_CAPTION_CONFIRM
 *
 * Entered when the caption parser found a fuzzy (not exact) customer name
 * match. We ask the user to confirm before proceeding.
 *
 *   payload.pendingCustomerId   — fuzzy-resolved customer ID
 *   payload.pendingCustomerName — human-readable name to show in the question
 *   payload.pendingPricePerGallon — resolved price for this customer
 *
 * Transitions:
 *   sí / si / yes / 1 → WAITING_PAYMENT_TYPE (with customerId set from pending)
 *   no / 2            → WAITING_CUSTOMER (ask manually)
 *   else              → re-prompt
 */

import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"

const YES_WORDS = new Set(["sí","si","s","yes","y","1","ok","dale","correcto","eso","ese"])
const NO_WORDS  = new Set(["no","n","2","otro","otra","cancelar"])

export const waitingCaptionConfirmHandler: StateHandler = {
  state: ConversationState.WAITING_CAPTION_CONFIRM,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, conversation } = ctx
    const p = conversation.payload

    if (YES_WORDS.has(message)) {
      if (!p.pendingCustomerId || !p.pendingCustomerName) {
        return {
          reply:           `⚠️ Error interno: datos del cliente no disponibles. Escribe el nombre del cliente manualmente.`,
          nextState:       ConversationState.WAITING_CUSTOMER,
          nextPayload:     {},
          endConversation: false,
        }
      }
      return {
        reply:
          `✅ *Cliente confirmado: ${p.pendingCustomerName}*\n\n` +
          `Galones detectados: *${p.gallons?.toFixed(2) ?? "?"} gal*\n\n` +
          `¿Cómo se realiza el pago?\n` +
          `• *efectivo* — pago en efectivo\n` +
          `• *crédito* — registrar como crédito`,
        nextState:       ConversationState.WAITING_PAYMENT_TYPE,
        nextPayload:     {
          customerId:     p.pendingCustomerId,
          customerName:   p.pendingCustomerName,
          pricePerGallon: p.pendingPricePerGallon,
        },
        endConversation: false,
      }
    }

    if (NO_WORDS.has(message)) {
      return {
        reply:
          `Entendido. ¿Para qué cliente es este suministro?\n` +
          `Escribe el nombre del cliente.`,
        nextState:       ConversationState.WAITING_CUSTOMER,
        nextPayload:     {},
        endConversation: false,
      }
    }

    return {
      reply:
        `¿Te refieres al cliente *${p.pendingCustomerName ?? "?"}*?\n\n` +
        `• Responde *sí* para confirmar\n` +
        `• Responde *no* para escribir otro nombre`,
      endConversation: false,
    }
  },
}
