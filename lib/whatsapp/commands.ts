/**
 * FuelOps-DR — WhatsApp Command Handler (Nova)
 *
 * Comandos conectados a lib/reporting.ts (datos reales de Supabase):
 *   inventario    → getInventoryStatus()
 *   ventas hoy    → getSalesMetrics(getDateRange("today"))
 *   clientes deuda → getCustomerDebtReport()
 *
 * Para agregar un nuevo comando:
 *   1. Agrega una función handler abajo
 *   2. Regístrala en COMMANDS con sus alias
 *   3. La función debe devolver string (mensaje de WhatsApp)
 */

import { sendTextMessage } from "./client"
import type { IncomingMessage } from "./types"
import {
  getInventoryStatus,
  getSalesMetrics,
  getCustomerDebtReport,
  getDateRange,
} from "@/lib/reporting"
import { getSystemSettings } from "@/lib/system-settings"

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtRD  = (n: number) => `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtGal = (n: number) => `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`

// ─── Static response strings ──────────────────────────────────────────────────

const GREETING = (name: string | null) =>
  `👋 Hola${name ? `, *${name}*` : ""}! Soy *Nova*, el asistente de *FuelOps-DR*.\n\n` +
  `Escribe un comando:\n` +
  `• *inventario*\n• *ventas hoy*\n• *clientes deuda*\n• *ayuda*`

const HELP =
  `📋 *Comandos disponibles:*\n\n` +
  `• *inventario* — nivel actual del tanque\n` +
  `• *ventas hoy* — resumen de ventas del día\n` +
  `• *clientes deuda* — clientes con saldo pendiente\n` +
  `• *ayuda* — mostrar este menú`

const NOT_UNDERSTOOD = (text: string) =>
  `❓ No reconozco: _"${text}"_\n\nEscribe *ayuda* para ver los comandos disponibles.`

const NON_TEXT =
  `👋 Soy *Nova*, el asistente de *FuelOps-DR*.\n\n` +
  `Solo entiendo texto. Escribe *ayuda* para ver los comandos.`

const ERROR_MSG = (cmd: string) =>
  `⚠ No pude obtener los datos de *${cmd}* en este momento.\n\nIntenta de nuevo en unos segundos o revisa la app.`

// ─── Live command handlers ────────────────────────────────────────────────────

async function cmdInventario(): Promise<string> {
  const [inv, settings] = await Promise.all([
    getInventoryStatus(),
    getSystemSettings(),
  ])

  const pct    = inv.percentage.toFixed(1)
  const days   = inv.estimatedDaysLeft === Infinity ? "N/D" : `~${inv.estimatedDaysLeft} días`
  const alert  = inv.available <= settings.alertRedGallons    ? "🔴 CRÍTICO"
               : inv.available <= settings.alertYellowGallons ? "🟡 Bajo"
               : "🟢 Normal"

  return (
    `⛽ *Inventario de combustible*\n\n` +
    `Disponible: *${fmtGal(inv.available)}* (${pct}%)\n` +
    `Estado: ${alert}\n` +
    `Consumo hoy: ${fmtGal(inv.consumedToday)}\n` +
    `Consumo este mes: ${fmtGal(inv.consumedThisMonth)}\n` +
    `Autonomía estimada: *${days}*`
  )
}

async function cmdVentasHoy(): Promise<string> {
  const [sales, kpis] = await Promise.all([
    getSalesMetrics(getDateRange("today")),
    import("@/lib/reporting").then(m => m.getDashboardKPIs()),
  ])

  if (sales.transactionCount === 0) {
    return `📊 *Ventas de hoy*\n\nAún no hay ventas registradas hoy.`
  }

  return (
    `📊 *Ventas de hoy*\n\n` +
    `Total: *${fmtRD(sales.totalAmount)}*\n` +
    `Galones: *${fmtGal(sales.totalGallons)}*\n` +
    `Suministros: ${sales.transactionCount}\n` +
    `Efectivo: ${fmtRD(sales.cashSales)}\n` +
    `Crédito: ${fmtRD(sales.creditSales)}\n` +
    `Precio promedio: ${fmtRD(sales.avgPricePerGallon)}/gal\n\n` +
    `Cobrado hoy: *${fmtRD(kpis.collectedToday)}*`
  )
}

async function cmdClientesDeuda(): Promise<string> {
  const debtors = await getCustomerDebtReport()

  if (debtors.length === 0) {
    return `✅ *Clientes con deuda*\n\nNo hay clientes con saldo pendiente. ¡Todo al día!`
  }

  const top5 = debtors.slice(0, 5)
  const total = debtors.reduce((s, c) => s + c.currentBalance, 0)

  const lines = top5.map((c, i) =>
    `${i + 1}. *${c.customerName}*\n` +
    `   ${fmtRD(c.currentBalance)}${c.overdueInvoices > 0 ? ` ⚠ ${c.overdueInvoices} vencida${c.overdueInvoices > 1 ? "s" : ""}` : ""}`
  ).join("\n\n")

  const more = debtors.length > 5 ? `\n\n_...y ${debtors.length - 5} más_` : ""

  return (
    `💰 *Clientes con saldo pendiente*\n\n` +
    lines + more + `\n\n` +
    `Total por cobrar: *${fmtRD(total)}*\n` +
    `Clientes: ${debtors.length}`
  )
}

// ─── Command registry ─────────────────────────────────────────────────────────

type CommandFn = (msg: IncomingMessage) => Promise<string>

const COMMANDS: Record<string, CommandFn> = {
  "ayuda":           async () => HELP,
  "help":            async () => HELP,
  "menu":            async () => HELP,
  "menú":            async () => HELP,

  "inventario":      async () => cmdInventario(),
  "combustible":     async () => cmdInventario(),
  "tanque":          async () => cmdInventario(),

  "ventas hoy":      async () => cmdVentasHoy(),
  "ventas":          async () => cmdVentasHoy(),
  "ventas del día":  async () => cmdVentasHoy(),

  "clientes deuda":  async () => cmdClientesDeuda(),
  "deudas":          async () => cmdClientesDeuda(),
  "cobros":          async () => cmdClientesDeuda(),
  "clientes":        async () => cmdClientesDeuda(),
}

const GREETING_KEYWORDS = new Set([
  "hola","hi","hello","hey","buenas","ola",
  "buenos días","buenas tardes","buenas noches","buen día",
])

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova] ${who} → type=${msg.type} text="${msg.text ?? "(non-text)"}"`)

  if (msg.type !== "text" || !msg.text) {
    await sendTextMessage(msg.from, NON_TEXT)
    return
  }

  const normalised = msg.text.toLowerCase().trim()

  if (GREETING_KEYWORDS.has(normalised)) {
    console.log(`[Nova] ${who} → greeting`)
    await sendTextMessage(msg.from, GREETING(msg.senderName))
    return
  }

  const handler = COMMANDS[normalised]
  if (handler) {
    console.log(`[Nova] ${who} → command: "${normalised}"`)
    const start = Date.now()
    try {
      const response = await handler(msg)
      console.log(`[Nova] ${who} ← "${normalised}" replied in ${Date.now() - start}ms`)
      await sendTextMessage(msg.from, response)
    } catch (err) {
      console.error(`[Nova] ${who} ← "${normalised}" FAILED:`, err instanceof Error ? err.message : err)
      await sendTextMessage(msg.from, ERROR_MSG(normalised)).catch(() => {})
    }
    return
  }

  console.log(`[Nova] ${who} → unknown: "${normalised}"`)
  await sendTextMessage(msg.from, NOT_UNDERSTOOD(msg.text))
}
