/**
 * State: WAITING_PAYMENT_CUSTOMER
 *
 * A bank transfer receipt was detected. The extracted payment data is in
 * the payload. This state asks which customer the payment belongs to.
 *
 * Transitions:
 *   single match  → WAITING_PAYMENT_CONFIRM
 *   no match      → re-prompt (stay in WAITING_PAYMENT_CUSTOMER)
 *   multiple      → list them, re-prompt
 *   cancel words  → end conversation
 */

import { prisma } from "@/lib/prisma"
import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"

const CANCEL_WORDS = new Set(["no", "cancelar", "volver", "cancel", "salir"])

const fmtRD = (n: number | null) =>
  n !== null
    ? `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—"

export const waitingPaymentCustomerHandler: StateHandler = {
  state: ConversationState.WAITING_PAYMENT_CUSTOMER,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, rawMessage, conversation } = ctx
    const p = conversation.payload

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Pago cancelado.*\nEl comprobante no fue registrado.`,
        endConversation: true,
      }
    }

    const query = rawMessage.trim()

    const customers = await prisma.customer.findMany({
      where: {
        name:   { contains: query, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { id: true, name: true, currentBalance: true },
      take:    6,
      orderBy: { name: "asc" },
    })

    if (customers.length === 0) {
      return {
        reply:
          `❌ No encontré clientes con el nombre _"${query}"_.\n\n` +
          `Intenta con otro nombre, o escribe *cancelar* para anular.`,
        endConversation: false,
      }
    }

    if (customers.length === 1) {
      const c = customers[0]
      const amount    = p.paymentAmount ?? 0
      const balance   = c.currentBalance.toNumber()
      const remaining = Math.max(0, balance - amount)

      return {
        reply:
          `💳 *Resumen del pago*\n\n` +
          `Cliente:    *${c.name}*\n` +
          `Monto:      *${fmtRD(amount)}*\n` +
          (p.paymentBank      ? `Banco:      *${p.paymentBank}*\n`      : "") +
          (p.paymentReference ? `Referencia: *${p.paymentReference}*\n` : "") +
          (p.paymentDate      ? `Fecha:      *${p.paymentDate}*\n`      : "") +
          `\nDeuda actual:  *${fmtRD(balance)}*\n` +
          `Deuda restante: *${fmtRD(remaining)}*\n\n` +
          `¿Confirmas registrar este pago?\n` +
          `• *confirmar* — registrar definitivamente\n` +
          `• *cancelar* — anular`,
        nextState:       ConversationState.WAITING_PAYMENT_CONFIRM,
        nextPayload:     { customerId: c.id, customerName: c.name },
        endConversation: false,
      }
    }

    // Multiple matches
    const list = customers
      .slice(0, 5)
      .map((c, i) => `${i + 1}. ${c.name} — ${fmtRD(c.currentBalance.toNumber())} pendiente`)
      .join("\n")
    const more = customers.length > 5 ? `\n_...y más_` : ""

    return {
      reply:
        `Encontré varios clientes:\n\n${list}${more}\n\n` +
        `Escribe el nombre *exacto* del cliente, o *cancelar* para anular.`,
      endConversation: false,
    }
  },
}
