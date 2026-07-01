/**
 * State: WAITING_CONFIRM_SAVE
 *
 * Final confirmation before persisting the supply. Shows a full summary
 * and calls confirmSupply() on user approval.
 *
 * Transitions:
 *   save words   → end conversation (supply created)
 *   cancel words → end conversation (cancelled)
 *   else         → re-prompt (stay in WAITING_CONFIRM_SAVE)
 */

import { ConversationState } from "../types"
import type { StateHandler, ConversationContext, StateResult } from "../types"
import { confirmSupply } from "@/app/actions/supplies"

const SAVE_WORDS   = new Set(["guardar", "sí", "si", "ok", "confirmar", "dale", "👍", "👌", "yes", "listo"])
const CANCEL_WORDS = new Set(["no", "cancelar", "volver", "cancel", "salir"])

const fmtRD = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const waitingConfirmSaveHandler: StateHandler = {
  state: ConversationState.WAITING_CONFIRM_SAVE,

  async handle(ctx: ConversationContext): Promise<StateResult> {
    const { message, conversation } = ctx
    const p = conversation.payload

    if (CANCEL_WORDS.has(message)) {
      return {
        reply:           `❌ *Registro cancelado.*\nEl suministro no fue guardado.`,
        endConversation: true,
      }
    }

    if (!SAVE_WORDS.has(message)) {
      return {
        reply:
          `Responde:\n` +
          `• *guardar* — registrar el suministro definitivamente\n` +
          `• *cancelar* — anular sin guardar`,
        endConversation: false,
      }
    }

    // ── Create the supply ────────────────────────────────────────────────────
    try {
      const result = await confirmSupply({
        customerId:     p.customerId!,
        truckId:        p.truckId ?? null,
        gallons:        p.gallons,
        pricePerGallon: p.pricePerGallon!,
        paymentType:    p.paymentType!,
        notes:          `OCR WhatsApp — confianza ${p.confidence}% | ${p.ocrNotes}`.slice(0, 200),
      })

      const total = p.gallons * p.pricePerGallon!

      return {
        reply:
          `✅ *Suministro registrado exitosamente*\n\n` +
          `Factura:  *${result.invoiceNumber}*\n` +
          `Cliente:  *${result.customerName}*\n` +
          `Galones:  *${p.gallons.toFixed(2)} gal*\n` +
          `Precio:   *${fmtRD(p.pricePerGallon!)}/gal*\n` +
          `Total:    *${fmtRD(total)}*\n` +
          `Pago:     *${p.paymentType === "CASH" ? "Efectivo" : "Crédito"}*\n\n` +
          `_El inventario y la factura han sido actualizados._`,
        endConversation: true,
      }
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[Conversation/ConfirmSave] confirmSupply failed: ${msg}`)

      return {
        reply:
          `⚠️ No se pudo guardar el suministro:\n_${msg}_\n\n` +
          `Responde *guardar* para reintentar o *cancelar* para anular.`,
        endConversation: false,
      }
    }
  },
}
