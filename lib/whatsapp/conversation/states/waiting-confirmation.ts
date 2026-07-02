/**
 * State: WAITING_CONFIRMATION
 *
 * Entered after a successful OCR reading. The user sees the gallon value
 * and is asked whether to register the supply.
 *
 * Transitions:
 *   confirm keywords → WAITING_CUSTOMER
 *   cancel keywords  → end conversation
 *   anything else    → re-prompt (stay in WAITING_CONFIRMATION)
 */

import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"

const CONFIRM_WORDS = new Set([
  "registrar", "sí", "si", "ok", "dale", "confirmar", "👍", "👌",
  "yes", "sure", "listo", "va", "correcto", "registro",
])

const CANCEL_WORDS = new Set([
  "no", "cancelar", "volver", "cancel", "nope", "nop", "salir",
])

export const waitingConfirmationHandler: StateHandler = {
  state: ConversationState.WAITING_CONFIRMATION,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, conversation } = ctx
    const p = conversation.payload

    if (CONFIRM_WORDS.has(message)) {
      return {
        reply:
          `✅ *Lectura confirmada: ${p.gallons!.toFixed(2)} gal*\n\n` +
          `¿Para qué cliente es este suministro?\n` +
          `Escribe el nombre del cliente.`,
        nextState:       ConversationState.WAITING_CUSTOMER,
        nextPayload:     {},
        endConversation: false,
      }
    }

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Registro cancelado.*\nEl suministro no fue guardado.`,
        endConversation: true,
      }
    }

    // Unrecognized input — re-prompt without changing state
    return {
      reply:
        `Responde:\n` +
        `• *registrar* — confirmar suministro de *${p.gallons!.toFixed(2)} gal*\n` +
        `• *cancelar* — anular y descartar`,
      endConversation: false,
    }
  },
}
