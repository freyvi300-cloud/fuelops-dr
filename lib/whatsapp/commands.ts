/**
 * FuelOps-DR — WhatsApp Command Handler (Nova)
 *
 * Comandos conectados a lib/reporting.ts (datos reales de Supabase):
 *   inventario     → getInventoryStatus()
 *   ventas hoy     → getSalesMetrics(getDateRange("today"))
 *   clientes deuda → getCustomerDebtReport()
 *
 * Image handling (Phase 3.1):
 *   1. Send immediate ACK ("Imagen recibida, analizándola...")
 *   2. Download from Meta CDN
 *   3. Upload to Supabase Storage (bucket: whatsapp-images)
 *   4. Save metadata to WhatsAppImage table
 *   (Phase 3.2: run OCR and auto-register supply)
 */

import { sendTextMessage, downloadMedia } from "./client"
import { uploadToSupabase, saveWhatsAppImageRecord, buildStoragePath, updateOcrResult } from "./media"
import { analyzeMeterImage } from "./analyzeMeterImage"
import { RateLimitError } from "@/lib/ocr/meter/types"
import type { IncomingMessage } from "./types"
import {
  getInventoryStatus,
  getSalesMetrics,
  getCustomerDebtReport,
  getDashboardKPIs,
  getDateRange,
} from "@/lib/reporting"
import { getSystemSettings } from "@/lib/system-settings"

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtRD  = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtGal = (n: number) =>
  `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`

// ─── Static responses ─────────────────────────────────────────────────────────

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

const NON_TEXT_TEXT =
  `👋 Soy *Nova*, el asistente de *FuelOps-DR*.\n\n` +
  `Solo entiendo texto e imágenes. Escribe *ayuda* para ver los comandos.`

const ERROR_MSG = (cmd: string) =>
  `⚠ No pude obtener los datos de *${cmd}* en este momento.\n\nIntenta de nuevo en unos segundos.`

// ─── Live command handlers ────────────────────────────────────────────────────

async function cmdInventario(): Promise<string> {
  const [inv, settings] = await Promise.all([getInventoryStatus(), getSystemSettings()])
  const pct   = inv.percentage.toFixed(1)
  const days  = inv.estimatedDaysLeft === Infinity ? "N/D" : `~${inv.estimatedDaysLeft} días`
  const alert = inv.available <= settings.alertRedGallons    ? "🔴 CRÍTICO"
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
    getDashboardKPIs(),
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
  const top5  = debtors.slice(0, 5)
  const total = debtors.reduce((s, c) => s + c.currentBalance, 0)
  const lines = top5.map((c, i) =>
    `${i + 1}. *${c.customerName}*\n` +
    `   ${fmtRD(c.currentBalance)}` +
    (c.overdueInvoices > 0 ? ` ⚠ ${c.overdueInvoices} vencida${c.overdueInvoices > 1 ? "s" : ""}` : "")
  ).join("\n\n")
  const more  = debtors.length > 5 ? `\n\n_...y ${debtors.length - 5} más_` : ""
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
  "ayuda":          async () => HELP,
  "help":           async () => HELP,
  "menu":           async () => HELP,
  "menú":           async () => HELP,

  "inventario":     async () => cmdInventario(),
  "combustible":    async () => cmdInventario(),
  "tanque":         async () => cmdInventario(),

  "ventas hoy":     async () => cmdVentasHoy(),
  "ventas":         async () => cmdVentasHoy(),
  "ventas del día": async () => cmdVentasHoy(),

  "clientes deuda": async () => cmdClientesDeuda(),
  "deudas":         async () => cmdClientesDeuda(),
  "cobros":         async () => cmdClientesDeuda(),
  "clientes":       async () => cmdClientesDeuda(),
}

const GREETING_KEYWORDS = new Set([
  "hola","hi","hello","hey","buenas","ola",
  "buenos días","buenas tardes","buenas noches","buen día",
])

// ─── Image handler (Phase 3.1) ────────────────────────────────────────────────

/**
 * Processes a received WhatsApp image:
 *   1. ACK immediately so the user sees a fast response
 *   2. Download from Meta CDN (background)
 *   3. Upload to Supabase Storage (background)
 *   4. Save metadata to DB (background)
 *
 * Phase 3.2 will add OCR here and auto-register the supply.
 */
async function handleImageMessage(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova/Image] ${who} → IMAGE received, mediaId=${msg.imageId ?? "null"}`)

  if (!msg.imageId) {
    console.warn(`[Nova/Image] ${who} → image without mediaId, skipping`)
    await sendTextMessage(msg.from,
      `📷 Imagen recibida pero sin ID de media. Intenta enviarla de nuevo.`
    )
    return
  }

  // 1. Immediate ACK to user
  await sendTextMessage(msg.from,
    `📷 *Imagen recibida correctamente.*\nEstoy analizándola...`
  )
  console.log(`[Nova/Image] ${who} → ACK sent`)

  // 2. BLOCKING for diagnosis — webhook waits for full processing before returning 200
  // TODO: revert to fire-and-forget once the flow is confirmed working:
  //   processImageAsync(msg).catch(err => console.error(...))
  console.log(`[Nova/Image] ${who} → starting BLOCKING processImageAsync`)
  try {
    await processImageAsync(msg)
    console.log(`[Nova/Image] ${who} → BLOCKING processImageAsync DONE`)
  } catch (err) {
    const e = err as Error
    console.error(`[Nova/Image] ${who} → BLOCKING processImageAsync THREW:`, e.message)
    console.error(`[Nova/Image] stack:`, e.stack)
  }
}

async function processImageAsync(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova/Image] ═══ processImageAsync START — from=${msg.from} mediaId=${msg.imageId} ═══`)

  // ── Step 1: Download from Meta ─────────────────────────────────────────────
  console.log(`[Nova/Image] ── STEP 1: Download from Meta CDN ──`)
  let buffer: Buffer, mimeType: string, filename: string

  try {
    const dl = await downloadMedia(msg.imageId!)
    buffer   = dl.buffer
    mimeType = dl.mimeType
    filename = dl.filename
    console.log(`[Nova/Image] ── STEP 1 ✅ ${mimeType} ${buffer.length}B "${filename}"`)
  } catch (err) {
    const e = err as Error
    console.error(`[Nova/Image] ── STEP 1 ❌ Download FAILED`)
    console.error(`[Nova/Image]    message : ${e.message}`)
    console.error(`[Nova/Image]    cause   : ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[Nova/Image]    stack   : ${e.stack ?? "no stack"}`)
    return   // stop here — upload and DB steps skipped
  }

  // ── Step 2: Upload to Supabase Storage ─────────────────────────────────────
  const storagePath = buildStoragePath(msg.from, filename)
  console.log(`[Nova/Image] ── STEP 2: Upload to Supabase Storage → "${storagePath}"`)
  let storageUrl: string

  try {
    storageUrl = await uploadToSupabase(buffer, mimeType, storagePath)
    console.log(`[Nova/Image] ── STEP 2 ✅ ${storageUrl}`)
  } catch (err) {
    const e = err as Error
    console.error(`[Nova/Image] ── STEP 2 ❌ Supabase upload FAILED`)
    console.error(`[Nova/Image]    message : ${e.message}`)
    console.error(`[Nova/Image]    cause   : ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[Nova/Image]    stack   : ${e.stack ?? "no stack"}`)
    return
  }

  // ── Step 3: Save metadata to DB ────────────────────────────────────────────
  console.log(`[Nova/Image] ── STEP 3: Save to DB — mediaId=${msg.imageId}`)

  try {
    await saveWhatsAppImageRecord({
      mediaId:     msg.imageId!,
      senderPhone: msg.from,
      senderName:  msg.senderName,
      storageUrl,
      mimeType,
      caption:     null,
    })
    console.log(`[Nova/Image] ── STEP 3 ✅ DB record saved`)
  } catch (err) {
    const e = err as Error
    console.error(`[Nova/Image] ── STEP 3 ❌ DB save FAILED`)
    console.error(`[Nova/Image]    message : ${e.message}`)
    console.error(`[Nova/Image]    stack   : ${e.stack ?? "no stack"}`)
    // Non-fatal: image is in storage, DB can be retried
  }

  // ── Step 4: Analyze with Gemini Vision ─────────────────────────────────────
  console.log(`[Nova/Image] ── STEP 4: Gemini OCR ──`)

  let ocrGallons:    number | null = null
  let ocrConfidence: number        = 0
  let ocrQuality:    string        = "mala"
  let ocrNotes:      string        = ""
  let ocrProvider:   string        = "gemini/gemini-2.0-flash"
  let ocrRawText:    string        = ""

  try {
    const ocr   = await analyzeMeterImage(buffer)
    ocrGallons    = ocr.gallons
    ocrConfidence = ocr.confidence
    ocrQuality    = ocr.imageQuality
    ocrNotes      = ocr.notes
    ocrProvider   = ocr.provider
    ocrRawText    = ocr.rawText
    console.log(`[Nova/Image] ── STEP 4 ✅ gallons=${ocrGallons} confidence=${ocrConfidence}% quality=${ocrQuality}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error(`[Nova/Image] ── STEP 4 ❌ RATE LIMIT: ${(err as Error).message}`)
      await sendTextMessage(
        msg.from,
        "⚠️ El sistema está ocupado procesando imágenes.\nPor favor intenta nuevamente en unos segundos."
      )
      console.log(`[Nova/Image] ── Rate limit reply sent — stopping pipeline`)
      return
    }
    const e = err as Error
    console.error(`[Nova/Image] ── STEP 4 ❌ Gemini OCR FAILED: ${e.message}`)
    // Don't stop — we still save what we have and reply to the user
  }

  // ── Step 5: Save OCR result to DB ──────────────────────────────────────────
  console.log(`[Nova/Image] ── STEP 5: Save OCR result to DB ──`)

  try {
    await updateOcrResult(msg.imageId!, {
      ocrGallons, ocrConfidence, ocrQuality, ocrNotes, ocrProvider, ocrRawText,
    })
    console.log(`[Nova/Image] ── STEP 5 ✅`)
  } catch (err) {
    console.error(`[Nova/Image] ── STEP 5 ❌ DB OCR save failed: ${(err as Error).message}`)
    // Non-fatal
  }

  // ── Step 6: Reply to user with OCR result ───────────────────────────────────
  // Three-tier confidence model:
  //   HIGH  (≥ ocrMinConfidence, default 90%) → confirmed reading, offer to register
  //   MED   (≥ 70%, < ocrMinConfidence)       → "approximately X gal, please confirm"
  //   LOW   (< 70% OR gallons === null)        → ask for better photo
  console.log(`[Nova/Image] ── STEP 6: Send OCR reply ──`)

  try {
    const settings  = await getSystemSettings()
    const highThreshold = settings.ocrMinConfidence  // e.g. 90
    const medThreshold  = 70                         // fixed floor for "approximate" tier

    const qualityLabel: Record<string, string> = {
      buena: "buena 👍", regular: "regular ⚠️", mala: "mala ❌",
    }

    const hasGallons  = ocrGallons !== null
    const isHigh      = hasGallons && ocrConfidence >= highThreshold
    const isMed       = hasGallons && !isHigh && ocrConfidence >= medThreshold

    if (isHigh) {
      // Confirmed reading — offer to register
      await sendTextMessage(msg.from,
        `⛽ *Análisis completado*\n\n` +
        `Lectura detectada: *${ocrGallons!.toFixed(2)} gal*\n` +
        `Confianza: ${ocrConfidence}%\n` +
        `Calidad: ${qualityLabel[ocrQuality] ?? ocrQuality}\n` +
        (ocrNotes ? `_${ocrNotes}_\n` : "") +
        `\n¿Deseas registrar este suministro?\nResponde *registrar* para confirmar.`
      )
      console.log(`[Nova/Image] ── STEP 6 ✅ HIGH confidence reply`)

    } else if (isMed) {
      // Approximate reading — ask user to confirm before registering
      await sendTextMessage(msg.from,
        `🔍 *Lectura aproximada*\n\n` +
        `Detecté aproximadamente *${ocrGallons!.toFixed(2)} gal*\n` +
        `Confianza: ${ocrConfidence}% (${ocrConfidence < highThreshold ? "debajo del umbral mínimo" : ""})\n` +
        `Calidad: ${qualityLabel[ocrQuality] ?? ocrQuality}\n` +
        (ocrNotes ? `_${ocrNotes}_\n` : "") +
        `\n¿Confirmas que la lectura es correcta?\n` +
        `Responde *registrar* para confirmar o envía una foto más clara.`
      )
      console.log(`[Nova/Image] ── STEP 6 ✅ MEDIUM confidence reply (${ocrConfidence}%)`)

    } else {
      // Cannot read — ask for better photo
      const reason = !hasGallons
        ? "No pude identificar un display de medidor en la foto."
        : `Confianza muy baja (${ocrConfidence}%) — imagen demasiado degradada.`

      await sendTextMessage(msg.from,
        `⚠️ *No pude leer el medidor*\n\n` +
        `${reason}\n\n` +
        `Para mejores resultados:\n` +
        `• Acerca más la cámara al display\n` +
        `• Asegura buena iluminación\n` +
        `• Evita reflejos y ángulos extremos\n` +
        `• Enfoca directamente sobre los números`
      )
      console.log(`[Nova/Image] ── STEP 6 ✅ LOW confidence reply (${ocrConfidence}%)`)
    }
  } catch (err) {
    console.error(`[Nova/Image] ── STEP 6 ❌ Reply failed: ${(err as Error).message}`)
  }

  console.log(`[Nova/Image] ═══ processImageAsync COMPLETE ═══`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova] ${who} → type=${msg.type} text="${msg.text ?? "(non-text)"}"`)

  // ── Image messages ─────────────────────────────────────────────────────────
  if (msg.type === "image") {
    await handleImageMessage(msg)
    return
  }

  // ── Non-text, non-image messages ───────────────────────────────────────────
  if (msg.type !== "text" || !msg.text) {
    await sendTextMessage(msg.from, NON_TEXT_TEXT)
    return
  }

  const normalised = msg.text.toLowerCase().trim()

  // ── Greetings ──────────────────────────────────────────────────────────────
  if (GREETING_KEYWORDS.has(normalised)) {
    console.log(`[Nova] ${who} → greeting`)
    await sendTextMessage(msg.from, GREETING(msg.senderName))
    return
  }

  // ── Commands ───────────────────────────────────────────────────────────────
  const handler = COMMANDS[normalised]
  if (handler) {
    const start = Date.now()
    console.log(`[Nova] ${who} → command: "${normalised}"`)
    try {
      const response = await handler(msg)
      console.log(`[Nova] ${who} ← "${normalised}" in ${Date.now() - start}ms`)
      await sendTextMessage(msg.from, response)
    } catch (err) {
      console.error(`[Nova] ${who} ← "${normalised}" FAILED:`,
        err instanceof Error ? err.message : err)
      await sendTextMessage(msg.from, ERROR_MSG(normalised)).catch(() => {})
    }
    return
  }

  // ── Unknown ────────────────────────────────────────────────────────────────
  console.log(`[Nova] ${who} → unknown: "${normalised}"`)
  await sendTextMessage(msg.from, NOT_UNDERSTOOD(msg.text))
}
