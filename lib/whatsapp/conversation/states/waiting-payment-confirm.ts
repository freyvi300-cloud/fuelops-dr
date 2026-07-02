/**
 * State: WAITING_PAYMENT_CONFIRM
 *
 * Final confirmation before persisting a payment extracted from a receipt.
 * Calls createPayment() on approval.
 *
 * Transitions:
 *   confirm words → end conversation (payment created)
 *   cancel words  → end conversation (cancelled)
 *   else          → re-prompt (stay in WAITING_PAYMENT_CONFIRM)
 */

import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"
import { createPayment } from "@/app/actions/payments"

const CONFIRM_WORDS = new Set(["confirmar", "sí", "si", "ok", "dale", "👍", "👌", "yes", "listo", "confirmo"])
const CANCEL_WORDS  = new Set(["no", "cancelar", "volver", "cancel", "salir"])

const fmtRD = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const waitingPaymentConfirmHandler: StateHandler = {
  state: ConversationState.WAITING_PAYMENT_CONFIRM,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, conversation } = ctx
    const p = conversation.payload

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Pago cancelado.*\nEl comprobante no fue registrado.`,
        endConversation: true,
      }
    }

    if (!CONFIRM_WORDS.has(message)) {
      return {
        reply:
          `Responde:\n` +
          `• *confirmar* — registrar el pago definitivamente\n` +
          `• *cancelar* — anular sin registrar`,
        endConversation: false,
      }
    }

    // ── Create the payment ───────────────────────────────────────────────────
    if (!p.customerId || !p.paymentAmount) {
      return {
        reply:           `⚠️ Error interno: faltan datos del pago. El registro fue cancelado.`,
        endConversation: true,
      }
    }

    try {
      const result = await createPayment({
        customerId:    p.customerId,
        amount:        p.paymentAmount,
        paymentMethod: "TRANSFER",
        reference:     p.paymentReference ?? null,
        notes:
          [
            p.paymentBank    ? `Banco: ${p.paymentBank}`         : null,
            p.paymentEmitter ? `Emisor: ${p.paymentEmitter}`     : null,
            p.paymentDate    ? `Fecha recibo: ${p.paymentDate}`  : null,
            "Registrado vía WhatsApp (comprobante)",
          ].filter(Boolean).join(" | ") || null,
        paymentDate:   p.paymentDate
          ? new Date(p.paymentDate).toISOString()
          : new Date().toISOString(),
      })

      return {
        reply:
          `✅ *Pago registrado exitosamente*\n\n` +
          `Recibo:    *${result.paymentNumber}*\n` +
          `Cliente:   *${result.customerName}*\n` +
          `Monto:     *${fmtRD(result.amount)}*\n` +
          `Método:    *Transferencia bancaria*\n` +
          (p.paymentReference ? `Ref:       *${p.paymentReference}*\n` : "") +
          `\n_La deuda del cliente ha sido actualizada._`,
        endConversation: true,
      }
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[Conversation/PaymentConfirm] createPayment failed: ${msg}`)

      return {
        reply:
          `⚠️ No se pudo registrar el pago:\n_${msg}_\n\n` +
          `Responde *confirmar* para reintentar o *cancelar* para anular.`,
        endConversation: false,
      }
    }
  },
}
