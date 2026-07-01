/**
 * State: WAITING_PAYMENT_TYPE
 *
 * Asks whether the supply is cash or credit.
 *
 * Transitions:
 *   cash words   → WAITING_CONFIRM_SAVE (paymentType = CASH)
 *   credit words → WAITING_CONFIRM_SAVE (paymentType = CREDIT)
 *   cancel words → end conversation
 *   else         → re-prompt
 */

import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"
import { resolveCustomerPrice } from "@/lib/pricing"
import { getSystemSettings } from "@/lib/system-settings"
import { prisma } from "@/lib/prisma"

const CASH_WORDS   = new Set(["efectivo", "cash", "contado", "contante"])
const CREDIT_WORDS = new Set(["crédito", "credito", "fiado", "fiao", "crédito"])
const CANCEL_WORDS = new Set(["no", "cancelar", "volver", "cancel", "salir"])

const fmtRD = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const waitingPaymentTypeHandler: StateHandler = {
  state: ConversationState.WAITING_PAYMENT_TYPE,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, conversation } = ctx
    const p = conversation.payload

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Registro cancelado.*\nEl suministro no fue guardado.`,
        endConversation: true,
      }
    }

    let paymentType: "CASH" | "CREDIT" | null = null
    if (CASH_WORDS.has(message))   paymentType = "CASH"
    if (CREDIT_WORDS.has(message)) paymentType = "CREDIT"

    if (!paymentType) {
      return {
        reply:
          `Por favor indica el tipo de pago:\n` +
          `• *efectivo* — pago en efectivo\n` +
          `• *crédito* — registrar como crédito\n` +
          `• *cancelar* — anular`,
        endConversation: false,
      }
    }

    // Resolve the effective price for the summary
    const [customer, settings] = await Promise.all([
      prisma.customer.findUnique({
        where:  { id: p.customerId! },
        select: { priceType: true, fuelPricePerGallon: true, priceDiscount: true },
      }),
      getSystemSettings(),
    ])

    const effectivePrice = customer
      ? resolveCustomerPrice(
          {
            priceType:          customer.priceType as "FIXED" | "DISCOUNT_PCT",
            fuelPricePerGallon: customer.fuelPricePerGallon.toNumber(),
            priceDiscount:      customer.priceDiscount.toNumber(),
          },
          settings.defaultFuelPrice,
        )
      : settings.defaultFuelPrice

    const total = p.gallons * effectivePrice

    return {
      reply:
        `📋 *Resumen del suministro*\n\n` +
        `Cliente:  *${p.customerName}*\n` +
        `Galones:  *${p.gallons.toFixed(2)} gal*\n` +
        `Precio:   *${fmtRD(effectivePrice)}/gal*\n` +
        `Total:    *${fmtRD(total)}*\n` +
        `Pago:     *${paymentType === "CASH" ? "Efectivo" : "Crédito"}*\n\n` +
        `¿Confirmas guardar este suministro?\n` +
        `• *guardar* — registrar definitivamente\n` +
        `• *cancelar* — anular`,
      nextState:   ConversationState.WAITING_CONFIRM_SAVE,
      nextPayload: { paymentType, pricePerGallon: effectivePrice },
      endConversation: false,
    }
  },
}
