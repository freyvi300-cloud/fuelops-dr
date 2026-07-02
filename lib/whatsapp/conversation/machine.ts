/**
 * FuelOps-DR — Conversation State Machine
 *
 * Registry-based dispatch: each ConversationState maps to exactly one
 * StateHandler. The machine itself never contains business logic.
 *
 * Adding a new state:
 *   1. Create states/<your-state>.ts implementing StateHandler
 *   2. Import and add to HANDLERS below
 *   Done — no other file needs to change.
 */

import type { ConversationState, StateHandler, ConversationContext, StateResult } from "./types"
import { waitingConfirmationHandler }    from "./states/waiting-confirmation"
import { waitingCustomerHandler }        from "./states/waiting-customer"
import { waitingPaymentTypeHandler }     from "./states/waiting-payment-type"
import { waitingConfirmSaveHandler }     from "./states/waiting-confirm-save"
import { waitingPaymentCustomerHandler } from "./states/waiting-payment-customer"
import { waitingPaymentConfirmHandler }  from "./states/waiting-payment-confirm"
import { waitingCaptionConfirmHandler }  from "./states/waiting-caption-confirm"

// ─── Handler registry ─────────────────────────────────────────────────────────
// Key = ConversationState value, value = handler for that state.

const HANDLERS = new Map<ConversationState, StateHandler>([
  [waitingConfirmationHandler.state,    waitingConfirmationHandler],
  [waitingCustomerHandler.state,        waitingCustomerHandler],
  [waitingPaymentTypeHandler.state,     waitingPaymentTypeHandler],
  [waitingConfirmSaveHandler.state,     waitingConfirmSaveHandler],
  [waitingPaymentCustomerHandler.state, waitingPaymentCustomerHandler],
  [waitingPaymentConfirmHandler.state,  waitingPaymentConfirmHandler],
  [waitingCaptionConfirmHandler.state,  waitingCaptionConfirmHandler],
])

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatch(ctx: ConversationContext): Promise<StateResult> {
  const handler = HANDLERS.get(ctx.conversation.state)

  if (!handler) {
    console.error(`[Machine] No handler for state="${ctx.conversation.state}" — ending conversation`)
    return {
      reply:           `⚠️ Error interno: estado desconocido. El registro fue cancelado.`,
      endConversation: true,
    }
  }

  console.log(`[Machine] ${ctx.phoneNumber} | state=${ctx.conversation.state} | msg="${ctx.message}"`)
  return handler.handle(ctx)
}
