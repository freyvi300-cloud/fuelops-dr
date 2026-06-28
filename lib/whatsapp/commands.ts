/**
 * FuelOps-DR — WhatsApp Command Handler (Nova)
 *
 * Add a new command:
 *   1. Add a key to COMMANDS map
 *   2. Write an async handler that returns a string
 *   3. Connect to reporting.ts when ready
 *
 * To connect a command to real data (example for "inventario"):
 *   import { getInventoryStatus } from "@/lib/reporting"
 *   "inventario": async () => {
 *     const s = await getInventoryStatus()
 *     return `⛽ Combustible disponible: ${s.available.toFixed(0)} gal (${s.percentage.toFixed(1)}%)`
 *   }
 */

import { sendTextMessage } from "./client"
import type { IncomingMessage } from "./types"

// ─── Response strings ─────────────────────────────────────────────────────────

const GREETING = (name: string | null) =>
  `👋 Hola${name ? `, *${name}*` : ""}! Soy *Nova*, el asistente de *FuelOps-DR*.\n\n` +
  `Escribe un comando para comenzar:\n` +
  `• *inventario*\n• *ventas hoy*\n• *clientes deuda*\n• *ayuda*`

const HELP =
  `📋 *Comandos disponibles:*\n\n` +
  `• *inventario* — nivel actual del tanque\n` +
  `• *ventas hoy* — resumen de ventas del día\n` +
  `• *clientes deuda* — clientes con saldo pendiente\n` +
  `• *ayuda* — mostrar este menú\n\n` +
  `_Próximamente: registrar suministros, consultar facturas y más._`

const COMING_SOON = (cmd: string) =>
  `🔄 *${cmd}*\n\n` +
  `Este comando estará conectado a FuelOps-DR en breve.\n` +
  `Escribe *ayuda* para ver todos los comandos disponibles.`

const NOT_UNDERSTOOD = (text: string) =>
  `❓ No reconozco: _"${text}"_\n\n` +
  `Escribe *ayuda* para ver los comandos disponibles.`

const NON_TEXT =
  `👋 Hola, soy *Nova*, el asistente de *FuelOps-DR*.\n\n` +
  `Por ahora solo entiendo texto. Escribe *ayuda* para ver los comandos disponibles.`

// ─── Command registry ─────────────────────────────────────────────────────────

type CommandFn = (msg: IncomingMessage) => Promise<string>

/**
 * Keys are lowercase trimmed strings the user might type.
 * Future: connect these to lib/reporting.ts functions.
 */
const COMMANDS: Record<string, CommandFn> = {
  // Help
  "ayuda":          async ()  => HELP,
  "help":           async ()  => HELP,
  "menu":           async ()  => HELP,
  "menú":           async ()  => HELP,

  // Inventory — TODO Phase 2: connect to getInventoryStatus() from lib/reporting.ts
  "inventario":     async ()  => COMING_SOON("inventario"),
  "combustible":    async ()  => COMING_SOON("inventario"),
  "tanque":         async ()  => COMING_SOON("inventario"),

  // Sales — TODO Phase 2: connect to getSalesMetrics(getDateRange("today"))
  "ventas hoy":     async ()  => COMING_SOON("ventas hoy"),
  "ventas":         async ()  => COMING_SOON("ventas hoy"),

  // Debtors — TODO Phase 2: connect to getCustomerDebtReport()
  "clientes deuda": async ()  => COMING_SOON("clientes deuda"),
  "deudas":         async ()  => COMING_SOON("clientes deuda"),
  "cobros":         async ()  => COMING_SOON("clientes deuda"),
}

// ─── Greeting detection ───────────────────────────────────────────────────────

const GREETING_KEYWORDS = new Set([
  "hola","hi","hello","hey","buenas","ola",
  "buenos días","buenas tardes","buenas noches","buen día",
])

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  console.log(
    `[WhatsApp/Nova] ${msg.senderName ?? msg.from} → ` +
    `type=${msg.type} text="${msg.text ?? "(non-text)"}"`
  )

  // Non-text message → send generic greeting
  if (msg.type !== "text" || !msg.text) {
    await sendTextMessage(msg.from, NON_TEXT)
    return
  }

  const normalised = msg.text.toLowerCase().trim()

  // Greeting
  if (GREETING_KEYWORDS.has(normalised)) {
    await sendTextMessage(msg.from, GREETING(msg.senderName))
    return
  }

  // Command lookup (exact match on normalised text)
  const handler = COMMANDS[normalised]
  if (handler) {
    const response = await handler(msg)
    await sendTextMessage(msg.from, response)
    return
  }

  // Unknown
  await sendTextMessage(msg.from, NOT_UNDERSTOOD(msg.text))
}
