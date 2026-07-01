/**
 * State: WAITING_CUSTOMER
 *
 * Searches customers by name. Handles 0, 1, or multiple matches.
 *
 * Transitions:
 *   single match  → WAITING_PAYMENT_TYPE
 *   no match      → re-prompt (stay in WAITING_CUSTOMER)
 *   multiple      → list them, re-prompt for exact name
 *   cancel words  → end conversation
 */

import { prisma } from "@/lib/prisma"
import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"

const CANCEL_WORDS = new Set(["no", "cancelar", "volver", "cancel", "salir"])

export const waitingCustomerHandler: StateHandler = {
  state: ConversationState.WAITING_CUSTOMER,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, rawMessage, conversation } = ctx
    const p = conversation.payload

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Registro cancelado.*\nEl suministro no fue guardado.`,
        endConversation: true,
      }
    }

    const query = rawMessage.trim()

    const customers = await prisma.customer.findMany({
      where: {
        name:   { contains: query, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { id: true, name: true, fuelPricePerGallon: true, priceType: true, priceDiscount: true },
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
      return {
        reply:
          `✅ *Cliente seleccionado: ${c.name}*\n\n` +
          `Galones detectados: *${p.gallons.toFixed(2)} gal*\n\n` +
          `¿Cómo se realiza el pago?\n` +
          `• *efectivo* — pago en efectivo\n` +
          `• *crédito* — registrar como crédito`,
        nextState:   ConversationState.WAITING_PAYMENT_TYPE,
        nextPayload: { customerId: c.id, customerName: c.name },
        endConversation: false,
      }
    }

    // Multiple matches — list them and ask for a more specific name
    const list = customers
      .slice(0, 5)
      .map((c, i) => `${i + 1}. ${c.name}`)
      .join("\n")
    const more = customers.length > 5 ? `\n_...y más_` : ""

    return {
      reply:
        `Encontré varios clientes con ese nombre:\n\n${list}${more}\n\n` +
        `Escribe el nombre *exacto* del cliente, o *cancelar* para anular.`,
      endConversation: false,
    }
  },
}
