/**
 * FuelOps-DR — WhatsApp Command Handler (Nova)
 *
 * Text commands:
 *   inventario     → getInventoryStatus()
 *   ventas hoy     → getSalesMetrics(getDateRange("today"))
 *   clientes deuda → getCustomerDebtReport()
 *
 * Image handling pipeline (full flow):
 *   1. ACK ("Imagen recibida, analizándola...")
 *   2. Download from Meta CDN
 *   3. Upload to Supabase Storage
 *   4. Save metadata to WhatsAppImage table
 *   5. Classify image: meter vs payment receipt vs unknown
 *      a. METER path:
 *         – Run OCR (analyzeMeterImage)
 *         – Parse caption for "Cliente: X / Camión: Y"
 *         – Auto-resolve customer+truck when possible
 *         – Start conversation at WAITING_PAYMENT_TYPE (if resolved) or WAITING_CONFIRMATION
 *      b. RECEIPT path:
 *         – Data already extracted in classify step
 *         – Start WAITING_PAYMENT_CUSTOMER conversation
 *      c. UNKNOWN path:
 *         – Ask the user to send meter or receipt image
 */

import { sendTextMessage, downloadMedia } from "./client"
import { uploadToSupabase, saveWhatsAppImageRecord, buildStoragePath, updateOcrResult } from "./media"
import { analyzeMeterImage } from "./analyzeMeterImage"
import { classifyImage } from "./classifyImage"
import { parseCaption } from "./parseCaption"
import { RateLimitError, ModelResponseError } from "@/lib/ocr/meter/types"
import {
  processConversation,
  startSupplyConversation,
  startPaymentConversation,
  ConversationState,
} from "./conversation/index"
import type { FlowPayload } from "./conversation/types"
import type { IncomingMessage } from "./types"
import {
  getInventoryStatus,
  getSalesMetrics,
  getCustomerDebtReport,
  getDashboardKPIs,
  getDateRange,
} from "@/lib/reporting"
import { getSystemSettings } from "@/lib/system-settings"
import { prisma } from "@/lib/prisma"
import { resolveCustomerPrice } from "@/lib/pricing"

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtRD  = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtGal = (n: number) =>
  `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`

// ─── Static responses ─────────────────────────────────────────────────────────

const GREETING = (name: string | null) =>
  `👋 Hola${name ? `, *${name}*` : ""}! Soy *Nova*, el asistente de *LBP Inversiones y Servicios*.\n\n` +
  `Escribe un comando:\n` +
  `• *inventario*\n• *ventas hoy*\n• *clientes deuda*\n• *ayuda*\n\n` +
  `También puedes enviar:\n` +
  `📷 Foto del medidor → registrar suministro\n` +
  `🧾 Foto de comprobante → registrar pago`

const HELP =
  `📋 *Comandos disponibles:*\n\n` +
  `• *inventario* — nivel actual del tanque\n` +
  `• *ventas hoy* — resumen de ventas del día\n` +
  `• *clientes deuda* — clientes con saldo pendiente\n` +
  `• *ayuda* — mostrar este menú\n\n` +
  `📷 *Envía una imagen:*\n` +
  `• Foto del medidor → registrar suministro\n` +
  `  Incluye en la descripción: _Cliente: Nombre / Camión: H201_\n` +
  `• Foto de comprobante de pago → registrar transferencia`

const NOT_UNDERSTOOD = (text: string) =>
  `❓ No reconozco: _"${text}"_\n\nEscribe *ayuda* para ver los comandos disponibles.`

const NON_TEXT_TEXT =
  `👋 Soy *Nova*, el asistente de *LBP Inversiones y Servicios*.\n\n` +
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

// ─── Caption auto-resolver ────────────────────────────────────────────────────

interface CaptionResolved {
  customerId:     string
  customerName:   string
  truckId:        string | null
  truckName:      string | null
  pricePerGallon: number
  /** true when the match was fuzzy and needs user confirmation */
  needsConfirm?:  boolean
  /** true when truckCode was specified but no truck with that code exists for this customer */
  truckNotFound?: boolean
}

/**
 * Simple word-overlap similarity: what fraction of tokens in `query`
 * appear (as a substring) in `target`?  Range 0–1.
 */
function tokenSimilarity(query: string, target: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (qTokens.length === 0) return 0
  const t = target.toLowerCase()
  const hits = qTokens.filter(tok => t.includes(tok)).length
  return hits / qTokens.length
}

async function resolveCaption(
  customerName: string,
  truckCode:    string | null,
): Promise<CaptionResolved | null> {
  console.log(`[resolveCaption] called with customerName="${customerName}" truckCode="${truckCode}"`)

  // 1. Exact substring match (case-insensitive) — original behavior
  console.log(`[resolveCaption] Prisma exact query: name contains "${customerName}"`)
  const exactMatches = await prisma.customer.findMany({
    where: { name: { contains: customerName, mode: "insensitive" }, status: "ACTIVE" },
    select: {
      id: true, name: true,
      priceType: true, fuelPricePerGallon: true, priceDiscount: true,
      trucks: {
        where: truckCode ? { code: truckCode, status: "ACTIVE" } : { status: "ACTIVE" },
        select: { id: true, code: true, name: true },
        take: 1,
      },
    },
    take: 3,
  })

  console.log(`[resolveCaption] exactMatches.length=${exactMatches.length} (names: ${exactMatches.map(c=>c.name).join(", ") || "none"})`)

  // Unambiguous exact match — proceed immediately
  if (exactMatches.length === 1) {
    const c       = exactMatches[0]
    const truck   = c.trucks[0] ?? null
    const settings = await getSystemSettings()
    const pricePerGallon = resolveCustomerPrice(
      {
        priceType:          c.priceType as "FIXED" | "DISCOUNT_PCT",
        fuelPricePerGallon: c.fuelPricePerGallon.toNumber(),
        priceDiscount:      c.priceDiscount.toNumber(),
      },
      settings.defaultFuelPrice,
    )
    const truckNotFound = truckCode !== null && truck === null
    if (truckNotFound) {
      console.log(`[resolveCaption] truckNotFound=true — truckCode="${truckCode}" not found for customer "${c.name}"`)
    }
    return { customerId: c.id, customerName: c.name, truckId: truck?.id ?? null, truckName: truck ? `${truck.code} · ${truck.name}` : null, pricePerGallon, truckNotFound }
  }

  // 2. No exact match or ambiguous — try fuzzy word-overlap against ALL customers
  console.log(`[resolveCaption] exact match failed (${exactMatches.length} results). Falling back to fuzzy…`)
  const allCustomers = await prisma.customer.findMany({
    where:  { status: "ACTIVE" },
    select: {
      id: true, name: true,
      priceType: true, fuelPricePerGallon: true, priceDiscount: true,
      trucks: {
        where: truckCode ? { code: truckCode, status: "ACTIVE" } : { status: "ACTIVE" },
        select: { id: true, code: true, name: true },
        take: 1,
      },
    },
  })

  const scored = allCustomers
    .map(c => ({ c, score: tokenSimilarity(customerName, c.name) }))
    .filter(x => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)

  console.log(`[resolveCaption] fuzzy scored candidates: [${scored.map(x=>`"${x.c.name}"=${x.score.toFixed(2)}`).join(", ") || "none"}]`)

  // Need a single candidate with meaningful confidence
  if (scored.length !== 1) {
    console.log(`[resolveCaption] fuzzy returned null (${scored.length} candidates — need exactly 1)`)
    return null
  }

  const { c, score } = scored[0]
  const truck   = c.trucks[0] ?? null
  const settings = await getSystemSettings()
  const pricePerGallon = resolveCustomerPrice(
    {
      priceType:          c.priceType as "FIXED" | "DISCOUNT_PCT",
      fuelPricePerGallon: c.fuelPricePerGallon.toNumber(),
      priceDiscount:      c.priceDiscount.toNumber(),
    },
    settings.defaultFuelPrice,
  )

  return {
    customerId:    c.id,
    customerName:  c.name,
    truckId:       truck?.id ?? null,
    truckName:     truck ? `${truck.code} · ${truck.name}` : null,
    pricePerGallon,
    needsConfirm:  score < 1.0,
    truckNotFound: truckCode !== null && truck === null,
  }
}

// ─── Image handler ────────────────────────────────────────────────────────────

async function handleImageMessage(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova/Image] ${who} → IMAGE mediaId=${msg.imageId ?? "null"} caption="${msg.imageCaption ?? "none"}"`)

  if (!msg.imageId) {
    await sendTextMessage(msg.from, `📷 Imagen recibida pero sin ID de media. Intenta enviarla de nuevo.`)
    return
  }

  await sendTextMessage(msg.from, `📷 *Imagen recibida correctamente.*\nEstoy analizándola...`)
  console.log(`[Nova/Image] ${who} → ACK sent`)

  try {
    await processImageAsync(msg)
  } catch (err) {
    console.error(`[Nova/Image] processImageAsync threw:`, (err as Error).message)
  }
}

async function processImageAsync(msg: IncomingMessage): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova/Image] ═══ processImageAsync START — from=${msg.from} ═══`)

  // ── Step 1: Download ───────────────────────────────────────────────────────
  let buffer: Buffer, mimeType: string, filename: string
  try {
    const dl = await downloadMedia(msg.imageId!)
    buffer   = dl.buffer
    mimeType = dl.mimeType
    filename = dl.filename
    console.log(`[Nova/Image] STEP 1 ✅ ${mimeType} ${buffer.length}B`)
  } catch (err) {
    console.error(`[Nova/Image] STEP 1 ❌ Download failed: ${(err as Error).message}`)
    return
  }

  // ── Step 2: Upload to Supabase ─────────────────────────────────────────────
  const storagePath = buildStoragePath(msg.from, filename)
  let storageUrl: string
  try {
    storageUrl = await uploadToSupabase(buffer, mimeType, storagePath)
    console.log(`[Nova/Image] STEP 2 ✅ ${storageUrl}`)
  } catch (err) {
    console.error(`[Nova/Image] STEP 2 ❌ Upload failed: ${(err as Error).message}`)
    return
  }

  // ── Step 3: Save metadata to DB ────────────────────────────────────────────
  try {
    await saveWhatsAppImageRecord({
      mediaId:     msg.imageId!,
      senderPhone: msg.from,
      senderName:  msg.senderName,
      storageUrl,
      mimeType,
      caption:     msg.imageCaption,
    })
    console.log(`[Nova/Image] STEP 3 ✅ DB record saved`)
  } catch (err) {
    console.error(`[Nova/Image] STEP 3 ❌ DB save failed: ${(err as Error).message}`)
  }

  // ── Step 4: Classify image ─────────────────────────────────────────────────
  console.log(`[Nova/Image] STEP 4: Classify image`)
  let classification: Awaited<ReturnType<typeof classifyImage>>
  try {
    classification = await classifyImage(buffer)
    console.log(`[Nova/Image] STEP 4 ✅ type=${classification.type}`)
  } catch (err) {
    console.error(`[Nova/Image] STEP 4 ❌ Classify failed: ${(err as Error).message}`)
    // Fall back to meter assumption
    classification = { type: "meter", receipt: null }
  }

  // ── RECEIPT path ───────────────────────────────────────────────────────────
  if (classification.type === "receipt") {
    await handleReceiptImage(msg, storageUrl, classification.receipt)
    return
  }

  // ── UNKNOWN path ───────────────────────────────────────────────────────────
  if (classification.type === "unknown") {
    await sendTextMessage(msg.from,
      `❓ No reconocí esta imagen como medidor ni comprobante de pago.\n\n` +
      `Por favor envía:\n` +
      `• 📷 Foto del *medidor* para registrar un suministro\n` +
      `• 🧾 Foto del *comprobante de transferencia* para registrar un pago`
    )
    return
  }

  // ── METER path ─────────────────────────────────────────────────────────────
  await handleMeterImage(msg, buffer, storageUrl)
}

// ── Meter flow ─────────────────────────────────────────────────────────────────

async function handleMeterImage(
  msg:        IncomingMessage,
  buffer:     Buffer,
  storageUrl: string,
): Promise<void> {
  const who = msg.senderName ?? msg.from

  // Step 5: OCR
  console.log(`[Nova/Image] STEP 5: OCR`)
  let ocrGallons:    number | null = null
  let ocrConfidence  = 0
  let ocrQuality     = "mala"
  let ocrNotes       = ""
  let ocrProvider    = "gemini/gemini-2.5-flash"
  let ocrRawText     = ""

  try {
    const ocr  = await analyzeMeterImage(buffer)
    ocrGallons    = ocr.gallons
    ocrConfidence = ocr.confidence
    ocrQuality    = ocr.imageQuality
    ocrNotes      = ocr.notes
    ocrProvider   = ocr.provider
    ocrRawText    = ocr.rawText
    console.log(`[Nova/Image] STEP 5 ✅ gallons=${ocrGallons} conf=${ocrConfidence}%`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      await sendTextMessage(msg.from, "⚠️ El sistema está ocupado. Intenta nuevamente en unos segundos.")
      return
    }
    if (err instanceof ModelResponseError) {
      await sendTextMessage(msg.from, "⚠️ Error interno procesando la imagen. Intenta nuevamente.")
      return
    }
    console.error(`[Nova/Image] STEP 5 ❌ OCR failed: ${(err as Error).message}`)
  }

  // Save OCR result
  try {
    await updateOcrResult(msg.imageId!, {
      ocrGallons, ocrConfidence, ocrQuality, ocrNotes, ocrProvider, ocrRawText,
    })
  } catch (err) {
    console.error(`[Nova/Image] OCR DB save failed: ${(err as Error).message}`)
  }

  // Step 6: Reply
  const settings     = await getSystemSettings()
  const highThreshold = settings.ocrMinConfidence
  const medThreshold  = 70

  const hasGallons = ocrGallons !== null
  const isHigh     = hasGallons && ocrConfidence >= highThreshold
  const isMed      = hasGallons && !isHigh && ocrConfidence >= medThreshold
  const isReadable = isHigh || isMed

  if (!isReadable) {
    const reason = !hasGallons
      ? "No pude identificar un display de medidor en la foto."
      : `Confianza muy baja (${ocrConfidence}%) — imagen demasiado degradada.`
    await sendTextMessage(msg.from,
      `⚠️ *No pude leer el medidor*\n\n${reason}\n\n` +
      `Para mejores resultados:\n` +
      `• Acerca más la cámara al display\n` +
      `• Asegura buena iluminación\n` +
      `• Evita reflejos y ángulos extremos`
    )
    return
  }

  // ── STEP 6b: Parse caption ────────────────────────────────────────────────
  console.log(`[Nova/Caption] RAW caption from msg: ${JSON.stringify(msg.imageCaption)}`)
  const parsed = parseCaption(msg.imageCaption)
  console.log(`[Nova/Caption] parseCaption result: customer="${parsed.customerName}" truck="${parsed.truckCode}" payment="${parsed.paymentType}"`)

  let resolved: Awaited<ReturnType<typeof resolveCaption>> = null

  if (parsed.customerName) {
    console.log(`[Nova/Caption] customerName found — calling resolveCaption("${parsed.customerName}", "${parsed.truckCode}")`)
    try {
      resolved = await resolveCaption(parsed.customerName, parsed.truckCode)
      if (resolved) {
        console.log(`[Nova/Caption] resolveCaption ✅ → customerId=${resolved.customerId} name="${resolved.customerName}" truckId=${resolved.truckId ?? "null"} needsConfirm=${resolved.needsConfirm ?? false}`)
      } else {
        console.log(`[Nova/Caption] resolveCaption returned null — customer not found or ambiguous`)
      }
    } catch (err) {
      console.error(`[Nova/Caption] resolveCaption threw: ${(err as Error).message}`)
    }
  } else {
    console.log(`[Nova/Caption] No customerName extracted from caption — skipping resolveCaption`)
  }

  const qualityLabel: Record<string, string> = {
    buena: "buena 👍", regular: "regular ⚠️", mala: "mala ❌",
  }
  const confNote = isHigh
    ? `Confianza: ${ocrConfidence}%`
    : `Confianza: ${ocrConfidence}% _(aproximada — confirma si es correcta)_`

  const basePayload: FlowPayload = {
    flowType:   "SUPPLY",
    mediaId:    msg.imageId!,
    imageUrl:   storageUrl,
    gallons:    ocrGallons!,
    confidence: ocrConfidence,
    quality:    ocrQuality,
    ocrNotes,
    provider:   ocrProvider,
  }

  console.log(`[Nova/Caption] resolved=${resolved ? "YES" : "NULL"} parsed.paymentType=${parsed.paymentType}`)

  if (resolved && parsed.truckCode && resolved.truckNotFound) {
    // ── BLOCKED: customer found but truck not registered for them ─────────
    console.log(`[Nova/Caption] → BLOCKED: customer "${resolved.customerName}" found but truck "${parsed.truckCode}" not registered for them`)
    await sendTextMessage(msg.from,
      `⚠️ *Rótulo no encontrado*\n\n` +
      `Encontré el cliente *${resolved.customerName}*, pero el rótulo *${parsed.truckCode}* no está registrado para ese cliente.\n\n` +
      `Opciones:\n` +
      `• Ve a *Camiones* en la app y registra el rótulo *${parsed.truckCode}* para *${resolved.customerName}*\n` +
      `• O envía la foto de nuevo con el rótulo correcto\n\n` +
      `_No se registró ningún suministro._`
    )
    return

  } else if (resolved && resolved.needsConfirm) {
    // ── FUZZY MATCH: ask user to confirm before proceeding ────────────────
    console.log(`[Nova/Caption] → WAITING_CAPTION_CONFIRM (fuzzy match, needs confirmation)`)
    const payload: FlowPayload = {
      ...basePayload,
      pendingCustomerId:    resolved.customerId,
      pendingCustomerName:  resolved.customerName,
      pendingPricePerGallon: resolved.pricePerGallon,
      truckId:   resolved.truckId,
      truckName: resolved.truckName,
    }
    await startSupplyConversation(msg.from, payload, ConversationState.WAITING_CAPTION_CONFIRM)

    await sendTextMessage(msg.from,
      `⛽ *Lectura del medidor*\n\n` +
      `Galones: *${ocrGallons!.toFixed(2)} gal*\n` +
      `${confNote}\n\n` +
      `Detecté el nombre _"${parsed.customerName}"_ en la descripción.\n` +
      `¿Te refieres al cliente *${resolved.customerName}*?\n\n` +
      `• Responde *sí* para confirmar\n` +
      `• Responde *no* para escribir el nombre correcto`
    )

  } else if (resolved && parsed.paymentType) {
    // ── FULL AUTO-RESOLVE: caption has customer + truck + payment type ─────
    // Skip all questions and jump straight to WAITING_CONFIRM_SAVE
    console.log(`[Nova/Caption] → WAITING_CONFIRM_SAVE (full auto: customer+truck+paymentType in caption)`)
    const total = ocrGallons! * resolved.pricePerGallon
    const payload: FlowPayload = {
      ...basePayload,
      customerId:     resolved.customerId,
      customerName:   resolved.customerName,
      truckId:        resolved.truckId,
      truckName:      resolved.truckName,
      pricePerGallon: resolved.pricePerGallon,
      paymentType:    parsed.paymentType,
    }
    await startSupplyConversation(msg.from, payload, ConversationState.WAITING_CONFIRM_SAVE)

    await sendTextMessage(msg.from,
      `⛽ *Suministro listo para registrar*\n\n` +
      `Galones:  *${ocrGallons!.toFixed(2)} gal*\n` +
      `${confNote}\n` +
      `Calidad:  ${qualityLabel[ocrQuality] ?? ocrQuality}\n` +
      (ocrNotes ? `_${ocrNotes}_\n` : "") +
      `\n✅ *Todo detectado desde la descripción:*\n` +
      `Cliente: *${resolved.customerName}*\n` +
      (resolved.truckName ? `Camión:  *${resolved.truckName}*\n` : "") +
      `Pago:    *${parsed.paymentType === "CASH" ? "Efectivo" : "Crédito"}*\n` +
      `Precio:  *${fmtRD(resolved.pricePerGallon)}/gal*\n` +
      `Total:   *${fmtRD(total)}*\n\n` +
      `¿Confirmas guardar este suministro?\n` +
      `• *guardar* — registrar definitivamente\n` +
      `• *cancelar* — anular`
    )

  } else if (resolved) {
    // ── PARTIAL AUTO-RESOLVE: customer+truck found but no payment type ─────
    console.log(`[Nova/Caption] → WAITING_PAYMENT_TYPE (customer resolved, missing payment type)`)
    const payload: FlowPayload = {
      ...basePayload,
      customerId:     resolved.customerId,
      customerName:   resolved.customerName,
      truckId:        resolved.truckId,
      truckName:      resolved.truckName,
      pricePerGallon: resolved.pricePerGallon,
    }
    await startSupplyConversation(msg.from, payload, ConversationState.WAITING_PAYMENT_TYPE)

    await sendTextMessage(msg.from,
      `⛽ *Lectura del medidor detectada*\n\n` +
      `Galones:  *${ocrGallons!.toFixed(2)} gal*\n` +
      `${confNote}\n` +
      `Calidad:  ${qualityLabel[ocrQuality] ?? ocrQuality}\n` +
      (ocrNotes ? `_${ocrNotes}_\n` : "") +
      `\n✅ *Cliente auto-detectado:*\n` +
      `Cliente: *${resolved.customerName}*\n` +
      (resolved.truckName ? `Camión:  *${resolved.truckName}*\n` : "") +
      `Precio:  *${fmtRD(resolved.pricePerGallon)}/gal*\n` +
      `Total:   *${fmtRD(ocrGallons! * resolved.pricePerGallon)}*\n\n` +
      `¿Cómo se realiza el pago?\n` +
      `• *efectivo* — pago en efectivo\n` +
      `• *crédito* — registrar como crédito\n` +
      `• *cancelar* — anular`
    )

  } else {
    // ── MANUAL FLOW: start from WAITING_CONFIRMATION ───────────────────────
    await startSupplyConversation(msg.from, basePayload)

    await sendTextMessage(msg.from,
      `⛽ *Lectura del medidor*\n\n` +
      `Galones detectados: *${ocrGallons!.toFixed(2)} gal*\n` +
      `${confNote}\n` +
      `Calidad: ${qualityLabel[ocrQuality] ?? ocrQuality}\n` +
      (ocrNotes ? `_${ocrNotes}_\n` : "") +
      `\n¿Deseas registrar este suministro?\n` +
      `Responde *registrar* para confirmar o *cancelar* para anular.\n\n` +
      `_Tip: incluye en la descripción de la foto:\n` +
      `Cliente: Nombre / Camión: H201_`
    )
    console.log(`[Nova/Image] ✅ Manual flow → WAITING_CONFIRMATION for ${who}`)
  }
}

// ── Receipt / payment flow ─────────────────────────────────────────────────────

async function handleReceiptImage(
  msg:        IncomingMessage,
  storageUrl: string,
  receipt:    Awaited<ReturnType<typeof classifyImage>>["receipt"],
): Promise<void> {
  const who = msg.senderName ?? msg.from
  console.log(`[Nova/Image] RECEIPT path — amount=${receipt?.amount} bank=${receipt?.bank}`)

  if (!receipt || receipt.amount === null) {
    await sendTextMessage(msg.from,
      `🧾 *Comprobante recibido*, pero no pude leer el monto claramente.\n\n` +
      `Por favor envía una foto más nítida del comprobante o registra el pago manualmente en la app.`
    )
    return
  }

  const payload: FlowPayload = {
    flowType:          "PAYMENT",
    mediaId:           msg.imageId!,
    imageUrl:          storageUrl,
    paymentAmount:     receipt.amount,
    paymentBank:       receipt.bank,
    paymentReference:  receipt.reference,
    paymentDate:       receipt.date,
    paymentEmitter:    receipt.emitter,
  }

  await startPaymentConversation(msg.from, payload)

  await sendTextMessage(msg.from,
    `🧾 *Comprobante de pago detectado*\n\n` +
    `Monto:      *${receipt.currency ?? "RD$"}${receipt.amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}*\n` +
    (receipt.bank      ? `Banco:      *${receipt.bank}*\n`      : "") +
    (receipt.reference ? `Referencia: *${receipt.reference}*\n` : "") +
    (receipt.date      ? `Fecha:      *${receipt.date}*\n`      : "") +
    (receipt.emitter   ? `Emisor:     *${receipt.emitter}*\n`   : "") +
    `\n¿A qué cliente corresponde este pago?\n` +
    `Escribe el nombre del cliente, o *cancelar* para anular.`
  )
  console.log(`[Nova/Image] ✅ Receipt → WAITING_PAYMENT_CUSTOMER for ${who}`)
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

  // ── Active conversation — intercept BEFORE command parsing ─────────────────
  try {
    const conversationReply = await processConversation(msg.from, msg.text)
    if (conversationReply !== null) {
      console.log(`[Nova] ${who} → conversation handled (state machine)`)
      await sendTextMessage(msg.from, conversationReply)
      return
    }
  } catch (err) {
    console.error(`[Nova] ${who} → conversation processing error:`, (err as Error).message)
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
