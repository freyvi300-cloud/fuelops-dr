/**
 * FuelOps-DR — Reporting Engine
 *
 * Single source of truth for all business calculations.
 * Used by: dashboard, /reportes page, email summaries, future PDF/Excel exports.
 *
 * NEVER duplicate these calculations elsewhere.
 * If a new view needs data, add a function here and call it.
 */

import { prisma }                               from "@/lib/prisma"
import { computeInventoryBalance }             from "@/lib/inventory-utils"
import { InvoiceStatus }                       from "@prisma/client"
import { getSystemSettings, type SystemSettings } from "@/lib/system-settings"

// ═══════════════════════════════════════════════════════════════════════════════
// DATE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export type Period = "today" | "week" | "month" | "year"

export interface DateRange {
  from:  Date
  to:    Date
  label: string
}

/**
 * República Dominicana = UTC-4 (AST, sin horario de verano).
 * All DB timestamps are UTC. To filter by the *local* business day we must
 * convert: local midnight = UTC midnight + 4 h → from = UTC 04:00:00 of the
 * same calendar date; to = UTC 03:59:59.999 of the next calendar date.
 *
 * Using a fixed offset (not the server's TZ) guarantees correct results
 * regardless of where the Next.js process is hosted (UTC, UTC-5, etc.).
 */
const LOCAL_TZ_OFFSET_HOURS = -4   // DR = UTC-4 (AST, no DST)

/**
 * Returns the UTC [start, end] that correspond to "today" in the local
 * business timezone, given the fixed offset LOCAL_TZ_OFFSET_HOURS.
 *
 * Example (DR, UTC-4):
 *   local today July 3  →  UTC from: Jul 3 04:00:00  |  UTC to: Jul 4 03:59:59.999
 */
export function localDayRange(): { start: Date; end: Date } {
  const nowUTC  = Date.now()
  // Shift UTC epoch to local time so getUTCFullYear/Month/Date return local values
  const localMs = nowUTC + LOCAL_TZ_OFFSET_HOURS * 3_600_000
  const local   = new Date(localMs)

  // Calendar date in local time, expressed as a UTC midnight point
  const localMidnightUTC = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())

  // Convert back to actual UTC: subtract the offset (offset is negative for west)
  const utcStart = new Date(localMidnightUTC - LOCAL_TZ_OFFSET_HOURS * 3_600_000)
  const utcEnd   = new Date(utcStart.getTime() + 86_400_000 - 1)   // +24h -1ms

  return { start: utcStart, end: utcEnd }
}

/**
 * Same as localDayRange() but for the first day of the current local month.
 * Returns UTC boundaries for [local month start 00:00 → now].
 */
export function localMonthStart(): Date {
  const nowUTC  = Date.now()
  const localMs = nowUTC + LOCAL_TZ_OFFSET_HOURS * 3_600_000
  const local   = new Date(localMs)
  // First day of the local month at midnight local = UTC
  const localFirstMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
  return new Date(localFirstMs - LOCAL_TZ_OFFSET_HOURS * 3_600_000)
}

export function getDateRange(period: Period): DateRange {
  const { start: todayStart, end: todayEnd } = localDayRange()
  const monthStart = localMonthStart()

  if (period === "today") {
    return { from: todayStart, to: todayEnd, label: "Hoy" }
  }
  if (period === "week") {
    // Find Monday of the current local week
    const nowUTC  = Date.now()
    const localMs = nowUTC + LOCAL_TZ_OFFSET_HOURS * 3_600_000
    const local   = new Date(localMs)
    const dayOfWeek = local.getUTCDay() || 7   // 1=Mon … 7=Sun
    const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dayOfWeek + 1)
    const weekStart   = new Date(mondayLocal - LOCAL_TZ_OFFSET_HOURS * 3_600_000)
    return { from: weekStart, to: todayEnd, label: "Esta semana" }
  }
  if (period === "month") {
    return { from: monthStart, to: todayEnd, label: "Este mes" }
  }
  // year — use local year start
  const nowUTC  = Date.now()
  const localMs = nowUTC + LOCAL_TZ_OFFSET_HOURS * 3_600_000
  const local   = new Date(localMs)
  const yearStartLocal = Date.UTC(local.getUTCFullYear(), 0, 1)
  const yearStart      = new Date(yearStartLocal - LOCAL_TZ_OFFSET_HOURS * 3_600_000)
  return { from: yearStart, to: todayEnd, label: "Este año" }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardKPIs {
  // Sales
  salesToday:          number
  salesThisMonth:      number
  gallonsSoldToday:    number
  gallonsSoldThisMonth:number
  // Collections
  collectedToday:      number
  collectedThisMonth:  number
  // Inventory
  fuelAvailable:       number
  // Customers
  activeCustomers:     number
  // Invoices
  invoicesPending:     number
  invoicesOverdue:     number
}

export interface SalesMetrics {
  totalAmount:     number
  totalGallons:    number
  transactionCount:number
  cashSales:       number
  creditSales:     number
  avgPricePerGallon:number
}

export interface CollectionsMetrics {
  totalCollected:  number
  transactionCount:number
  byMethod: Array<{ method: string; label: string; amount: number; count: number }>
}

export interface InventoryReport {
  openingBalance:  number   // balance at range.from
  totalIn:         number
  totalOut:        number
  totalAdjustments:number
  currentBalance:  number   // live balance (all time)
  netChange:       number   // totalIn - totalOut + totalAdjustments for the period
}

export interface CustomerDebtItem {
  customerId:      string
  customerName:    string
  customerPhone:   string | null
  currentBalance:  number
  pendingGallons:  number
  overdueInvoices: number
  lastSupplyDate:  string | null
}

export interface InvoiceStatusReport {
  total:              number
  pending:            number
  partiallyPaid:      number
  paid:               number
  overdue:            number
  cancelled:          number
  totalPendingAmount: number
  totalPaidAmount:    number
}

export interface TruckActivityItem {
  truckId:       string
  truckCode:     string
  truckName:     string
  customerName:  string
  supplyCount:   number
  totalGallons:  number
  lastSupplyDate:string | null
}

export interface DailyPoint {
  date:  string   // "YYYY-MM-DD"
  value: number
}

/** Full report — all sections combined, built with a single call */
export interface FullReport {
  period:        string
  dateRange:     { from: string; to: string; label: string }
  kpis:          DashboardKPIs
  sales:         SalesMetrics
  collections:   CollectionsMetrics
  inventory:     InventoryReport
  customerDebt:  CustomerDebtItem[]
  invoiceStatus: InvoiceStatusReport
  truckActivity: TruckActivityItem[]
  charts: {
    salesByDay:       DailyPoint[]
    collectionsByDay: DailyPoint[]
    gallonsByDay:     DailyPoint[]
    inventoryOverTime:DailyPoint[]
  }
}

// ── Export stubs (future Phase 2) ─────────────────────────────────────────────
export type ExportFormat = "pdf" | "excel" | "csv"
export interface ExportConfig {
  format:     ExportFormat
  reportType: string
  dateRange:  DateRange
  title:      string
}
// TODO Phase 2: implement export using react-pdf (PDF), xlsx (Excel), papaparse (CSV)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function exportReport(_config: ExportConfig): Promise<never> {
  throw new Error("Export not yet implemented. See TODO in lib/reporting.ts")
}

// ── Email summary stubs (future Phase 3) ─────────────────────────────────────
export interface EmailSummary {
  subject:     string
  period:      string
  generatedAt: string
  report:      FullReport
  // TODO Phase 3: htmlBody, textBody, recipients, attachments
}
// TODO Phase 3: implement email sending using Resend or SendGrid
export async function buildDailySummary():   Promise<EmailSummary> { return _buildSummary("today",  "Resumen diario") }
export async function buildWeeklySummary():  Promise<EmailSummary> { return _buildSummary("week",   "Resumen semanal") }
export async function buildMonthlySummary(): Promise<EmailSummary> { return _buildSummary("month",  "Resumen mensual") }

async function _buildSummary(period: Period, prefix: string): Promise<EmailSummary> {
  const report = await buildFullReport(period)
  const range  = getDateRange(period)
  return {
    subject:     `${prefix} FuelOps-DR — ${range.label}`,
    period,
    generatedAt: new Date().toISOString(),
    report,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE COMPUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const { start: todayStart, end: todayEnd } = localDayRange()
  const monthStart = localMonthStart()

  const [
    todaySales, monthSales,
    todayPayments, monthPayments,
    allMovements,
    activeCustomers,
    invoicesPending, invoicesOverdue,
  ] = await Promise.all([
    // Sales today/month
    prisma.supply.aggregate({
      where: { suppliedAt: { gte: todayStart, lte: todayEnd } },
      _sum: { total: true, gallons: true },
    }),
    prisma.supply.aggregate({
      where: { suppliedAt: { gte: monthStart } },
      _sum: { total: true, gallons: true },
    }),
    // Collections today/month
    prisma.payment.aggregate({
      where: { paymentDate: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    // Inventory
    prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } }),
    // Customers
    prisma.customer.count({ where: { status: "ACTIVE" } }),
    // Invoices
    prisma.invoice.count({ where: { status: InvoiceStatus.PENDING } }),
    prisma.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
  ])

  return {
    salesToday:            todaySales._sum.total?.toNumber()          ?? 0,
    salesThisMonth:        monthSales._sum.total?.toNumber()          ?? 0,
    gallonsSoldToday:      todaySales._sum.gallons?.toNumber()        ?? 0,
    gallonsSoldThisMonth:  monthSales._sum.gallons?.toNumber()        ?? 0,
    collectedToday:        todayPayments._sum.amount?.toNumber()      ?? 0,
    collectedThisMonth:    monthPayments._sum.amount?.toNumber()      ?? 0,
    fuelAvailable:         Math.max(0, computeInventoryBalance(allMovements)),
    activeCustomers,
    invoicesPending,
    invoicesOverdue,
  }
}

export async function getSalesMetrics(range: DateRange): Promise<SalesMetrics> {
  const supplies = await prisma.supply.findMany({
    where: { suppliedAt: { gte: range.from, lte: range.to } },
    select: { total: true, gallons: true, pricePerGallon: true, paymentType: true },
  })
  if (supplies.length === 0) {
    return { totalAmount: 0, totalGallons: 0, transactionCount: 0, cashSales: 0, creditSales: 0, avgPricePerGallon: 0 }
  }
  const totalAmount      = supplies.reduce((s, r) => s + r.total.toNumber(), 0)
  const totalGallons     = supplies.reduce((s, r) => s + r.gallons.toNumber(), 0)
  const cashSales        = supplies.filter(r => r.paymentType === "CASH").reduce((s, r) => s + r.total.toNumber(), 0)
  const creditSales      = totalAmount - cashSales
  const sumPrice         = supplies.reduce((s, r) => s + r.pricePerGallon.toNumber(), 0)
  const avgPricePerGallon = sumPrice / supplies.length

  return { totalAmount, totalGallons, transactionCount: supplies.length, cashSales, creditSales, avgPricePerGallon }
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo", TRANSFER: "Transferencia",
  BANK_DEPOSIT: "Depósito", CHECK: "Cheque", OTHER: "Otro",
}

export async function getCollectionsMetrics(range: DateRange): Promise<CollectionsMetrics> {
  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: range.from, lte: range.to } },
    select: { amount: true, paymentMethod: true },
  })
  const totalCollected = payments.reduce((s, p) => s + p.amount.toNumber(), 0)
  const methodMap: Record<string, { amount: number; count: number }> = {}
  for (const p of payments) {
    const m = p.paymentMethod
    if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 }
    methodMap[m].amount += p.amount.toNumber()
    methodMap[m].count++
  }
  const byMethod = Object.entries(methodMap).map(([method, v]) => ({
    method, label: METHOD_LABELS[method] ?? method, ...v,
  })).sort((a, b) => b.amount - a.amount)

  return { totalCollected, transactionCount: payments.length, byMethod }
}

export async function getInventoryReport(range: DateRange): Promise<InventoryReport> {
  const [beforePeriod, periodMovements, allMovements] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where:  { movedAt: { lt: range.from } },
      select: { type: true, gallons: true },
    }),
    prisma.inventoryMovement.findMany({
      where:  { movedAt: { gte: range.from, lte: range.to } },
      select: { type: true, gallons: true },
    }),
    prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } }),
  ])

  const openingBalance   = computeInventoryBalance(beforePeriod)
  const currentBalance   = Math.max(0, computeInventoryBalance(allMovements))
  const totalIn          = periodMovements.filter(m => m.type === "IN").reduce((s, m) => s + m.gallons.toNumber(), 0)
  const totalOut         = periodMovements.filter(m => m.type === "OUT").reduce((s, m) => s + m.gallons.toNumber(), 0)
  const totalAdjustments = periodMovements.filter(m => m.type === "ADJUSTMENT").reduce((s, m) => s + m.gallons.toNumber(), 0)
  const netChange        = totalIn - totalOut + totalAdjustments

  return { openingBalance, totalIn, totalOut, totalAdjustments, currentBalance, netChange }
}

export async function getCustomerDebtReport(): Promise<CustomerDebtItem[]> {
  const [customers, overdueByCustomer] = await Promise.all([
    prisma.customer.findMany({
      where:   { currentBalance: { gt: 0 } },
      select:  {
        id: true, name: true, phone: true,
        currentBalance: true, pendingGallons: true,
        supplies: { select: { suppliedAt: true }, orderBy: { suppliedAt: "desc" }, take: 1 },
      },
      orderBy: { currentBalance: "desc" },
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: InvoiceStatus.OVERDUE },
      _count: { id: true },
    }),
  ])

  const overdueMap: Record<string, number> = {}
  for (const r of overdueByCustomer) overdueMap[r.customerId] = r._count.id

  return customers.map(c => ({
    customerId:      c.id,
    customerName:    c.name,
    customerPhone:   c.phone,
    currentBalance:  c.currentBalance.toNumber(),
    pendingGallons:  c.pendingGallons.toNumber(),
    overdueInvoices: overdueMap[c.id] ?? 0,
    lastSupplyDate:  c.supplies[0]?.suppliedAt.toISOString() ?? null,
  }))
}

export async function getInvoiceStatusReport(range: DateRange): Promise<InvoiceStatusReport> {
  const [counts, pendingAgg, paidAgg] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["status"],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
      _sum:  { balanceDue: true },
    }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.PAID, createdAt: { gte: range.from, lte: range.to } },
      _sum:  { total: true },
    }),
  ])

  const map: Record<string, number> = {}
  let total = 0
  for (const r of counts) { map[r.status] = r._count.id; total += r._count.id }

  return {
    total,
    pending:            map.PENDING         ?? 0,
    partiallyPaid:      map.PARTIALLY_PAID  ?? 0,
    paid:               map.PAID            ?? 0,
    overdue:            map.OVERDUE         ?? 0,
    cancelled:          map.CANCELLED       ?? 0,
    totalPendingAmount: pendingAgg._sum.balanceDue?.toNumber() ?? 0,
    totalPaidAmount:    paidAgg._sum.total?.toNumber()         ?? 0,
  }
}

export async function getTruckActivityReport(range: DateRange): Promise<TruckActivityItem[]> {
  const supplies = await prisma.supply.findMany({
    where: {
      truckId:     { not: null },
      suppliedAt:  { gte: range.from, lte: range.to },
    },
    select: {
      truckId:    true,
      gallons:    true,
      suppliedAt: true,
      truck:      { select: { id: true, code: true, name: true, customer: { select: { name: true } } } },
    },
  })

  const map: Record<string, { code: string; name: string; customer: string; count: number; gallons: number; last: Date }> = {}
  for (const s of supplies) {
    if (!s.truck || !s.truckId) continue
    const key = s.truckId
    if (!map[key]) {
      map[key] = { code: s.truck.code, name: s.truck.name, customer: s.truck.customer.name, count: 0, gallons: 0, last: s.suppliedAt }
    }
    map[key].count++
    map[key].gallons += s.gallons.toNumber()
    if (s.suppliedAt > map[key].last) map[key].last = s.suppliedAt
  }

  return Object.entries(map)
    .map(([truckId, v]) => ({
      truckId,
      truckCode:     v.code,
      truckName:     v.name,
      customerName:  v.customer,
      supplyCount:   v.count,
      totalGallons:  v.gallons,
      lastSupplyDate:v.last.toISOString(),
    }))
    .sort((a, b) => b.totalGallons - a.totalGallons)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART DATA
// ═══════════════════════════════════════════════════════════════════════════════

function fillDailyGaps(data: Record<string, number>, range: DateRange): DailyPoint[] {
  const result: DailyPoint[] = []
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate())
  const end    = new Date(range.to.getFullYear(),   range.to.getMonth(),   range.to.getDate())
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ date: key, value: data[key] ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

export async function getSalesByDay(range: DateRange): Promise<DailyPoint[]> {
  const rows = await prisma.supply.findMany({
    where: { suppliedAt: { gte: range.from, lte: range.to } },
    select: { suppliedAt: true, total: true },
  })
  const byDay: Record<string, number> = {}
  for (const r of rows) {
    const d = r.suppliedAt.toISOString().slice(0, 10)
    byDay[d] = (byDay[d] ?? 0) + r.total.toNumber()
  }
  return fillDailyGaps(byDay, range)
}

export async function getGallonsByDay(range: DateRange): Promise<DailyPoint[]> {
  const rows = await prisma.supply.findMany({
    where: { suppliedAt: { gte: range.from, lte: range.to } },
    select: { suppliedAt: true, gallons: true },
  })
  const byDay: Record<string, number> = {}
  for (const r of rows) {
    const d = r.suppliedAt.toISOString().slice(0, 10)
    byDay[d] = (byDay[d] ?? 0) + r.gallons.toNumber()
  }
  return fillDailyGaps(byDay, range)
}

export async function getCollectionsByDay(range: DateRange): Promise<DailyPoint[]> {
  const rows = await prisma.payment.findMany({
    where: { paymentDate: { gte: range.from, lte: range.to } },
    select: { paymentDate: true, amount: true },
  })
  const byDay: Record<string, number> = {}
  for (const r of rows) {
    const d = r.paymentDate.toISOString().slice(0, 10)
    byDay[d] = (byDay[d] ?? 0) + r.amount.toNumber()
  }
  return fillDailyGaps(byDay, range)
}

export async function getInventoryOverTime(range: DateRange): Promise<DailyPoint[]> {
  const [beforeRows, periodRows] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { movedAt: { lt: range.from } },
      select: { type: true, gallons: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { movedAt: { gte: range.from, lte: range.to } },
      select: { movedAt: true, type: true, gallons: true },
      orderBy: { movedAt: "asc" },
    }),
  ])

  let running = computeInventoryBalance(beforeRows)
  const byDay: Record<string, typeof periodRows> = {}
  for (const m of periodRows) {
    const d = m.movedAt.toISOString().slice(0, 10)
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(m)
  }

  const result: DailyPoint[] = []
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate())
  const end    = new Date(range.to.getFullYear(),   range.to.getMonth(),   range.to.getDate())
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    for (const m of byDay[key] ?? []) {
      const g = m.gallons.toNumber()
      if (m.type === "IN")  running += g
      else if (m.type === "OUT") running -= g
      else running += g
    }
    result.push({ date: key, value: Math.max(0, running) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL REPORT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD 2.0 — TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Tank capacity and alert thresholds now come from SystemSettings (lib/system-settings.ts).
// No hardcoded values — admin configures them via /configuracion.

export interface InventoryStatus {
  available:           number
  tankCapacity:        number
  percentage:          number
  consumedToday:       number
  consumedThisMonth:   number
  avgDailyConsumption: number
  estimatedDaysLeft:   number   // Infinity when no consumption data
}

export interface ActivityItem {
  id:        string
  time:      string            // ISO string
  type:      "supply" | "payment"
  customer:  string
  truck:     string | null     // truck code
  amount:    number
  gallons:   number | null     // only for supplies
  status:    string            // paymentType or paymentMethod
  reference: string            // invoice number
}

export type AlertLevel = "critical" | "warning" | "ok"

export interface Alert {
  level:   AlertLevel
  title:   string
  message: string
  link:    string
  count?:  number
}

export interface TopCustomer {
  customerId:   string
  customerName: string
  gallons:      number
  revenue:      number
  rank:         number
}

export interface DashboardExtendedKPIs extends DashboardKPIs {
  pendingBalance: number   // SUM(balanceDue) of open invoices
}

export interface DashboardData {
  kpis:          DashboardExtendedKPIs
  inventory:     InventoryStatus
  activity:      ActivityItem[]
  alerts:        Alert[]
  topCustomers:  TopCustomer[]
  customerDebt:  CustomerDebtItem[]    // top 8 debtors
  truckActivity: TruckActivityItem[]   // top 6 by gallons
  charts: {
    salesLast30:      DailyPoint[]
    collectionsLast30:DailyPoint[]
    gallonsLast30:    DailyPoint[]
    inventoryLast30:  DailyPoint[]
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD 2.0 — FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pass `settings` when you already have them to avoid a second DB round-trip
 * (e.g. inside buildDashboardData). Omit to fetch internally.
 */
export async function getInventoryStatus(
  settings?: SystemSettings,
): Promise<InventoryStatus> {
  const { start: todayStart, end: todayEnd } = localDayRange()
  const monthStart  = localMonthStart()
  // daysElapsed: how many local days have passed in the current month (≥1)
  const nowUTC      = Date.now()
  const localMs     = nowUTC + LOCAL_TZ_OFFSET_HOURS * 3_600_000
  const daysElapsed = Math.max(1, new Date(localMs).getUTCDate())

  const [resolvedSettings, allMovements, todayOut, monthOut] = await Promise.all([
    settings ? Promise.resolve(settings) : getSystemSettings(),
    prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } }),
    prisma.inventoryMovement.aggregate({
      where: { type: "OUT", movedAt: { gte: todayStart, lte: todayEnd } },
      _sum:  { gallons: true },
    }),
    prisma.inventoryMovement.aggregate({
      where: { type: "OUT", movedAt: { gte: monthStart } },
      _sum:  { gallons: true },
    }),
  ])

  const available           = Math.max(0, computeInventoryBalance(allMovements))
  const consumedToday       = todayOut._sum.gallons?.toNumber()  ?? 0
  const consumedThisMonth   = monthOut._sum.gallons?.toNumber()  ?? 0
  const avgDailyConsumption = consumedThisMonth / daysElapsed
  const tankCap             = resolvedSettings.tankCapacity
  const percentage          = tankCap > 0
    ? Math.min(100, (available / tankCap) * 100)
    : 0
  const estimatedDaysLeft   = avgDailyConsumption > 0
    ? Math.floor(available / avgDailyConsumption)
    : Infinity

  return {
    available, tankCapacity: tankCap, percentage,
    consumedToday, consumedThisMonth, avgDailyConsumption, estimatedDaysLeft,
  }
}

export async function getActivityFeed(limit = 20): Promise<ActivityItem[]> {
  const { start: todayStart, end: todayEnd } = localDayRange()

  const [supplies, payments] = await Promise.all([
    prisma.supply.findMany({
      where:   { suppliedAt: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { name: true } },
        truck:    { select: { code: true } },
        invoice:  { select: { invoiceNumber: true } },
      },
      orderBy: { suppliedAt: "desc" },
      take:    limit,
    }),
    prisma.payment.findMany({
      where:   { paymentDate: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { name: true } },
        invoice:  { select: { invoiceNumber: true } },
      },
      orderBy: { paymentDate: "desc" },
      take:    limit,
    }),
  ])

  const items: ActivityItem[] = [
    ...supplies.map(s => ({
      id:        s.id,
      time:      s.suppliedAt.toISOString(),
      type:      "supply" as const,
      customer:  s.customer.name,
      truck:     s.truck?.code ?? null,
      amount:    s.total.toNumber(),
      gallons:   s.gallons.toNumber(),
      status:    s.paymentType,
      reference: s.invoice?.invoiceNumber ?? "",
    })),
    ...payments.map(p => ({
      id:        p.id,
      time:      p.paymentDate.toISOString(),
      type:      "payment" as const,
      customer:  p.customer.name,
      truck:     null,
      amount:    p.amount.toNumber(),
      gallons:   null,
      status:    p.paymentMethod,
      reference: p.invoice?.invoiceNumber ?? "",
    })),
  ]

  return items
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit)
}

/**
 * Pure function — no DB queries.
 * Alert thresholds come from SystemSettings, not hardcoded percentages.
 *
 *   inventory.available <= settings.alertRedGallons    → CRITICAL
 *   inventory.available <= settings.alertYellowGallons → WARNING (low)
 *   otherwise                                          → OK
 */
export function generateAlerts(
  kpis:      DashboardExtendedKPIs,
  inventory: InventoryStatus,
  settings:  Pick<SystemSettings, "alertRedGallons" | "alertYellowGallons">,
): Alert[] {
  const alerts: Alert[] = []
  const gal = inventory.available
  const days = inventory.estimatedDaysLeft

  // CRITICAL: at or below red threshold
  if (gal <= settings.alertRedGallons) {
    const autonomy = days === Infinity ? "" : ` Estimado: ${days} día${days !== 1 ? "s" : ""} restantes.`
    alerts.push({
      level:   "critical",
      title:   "Inventario crítico",
      message: `Solo quedan ${gal.toFixed(0)} gal — por debajo del mínimo configurado (${settings.alertRedGallons} gal).${autonomy}`,
      link:    "/inventario",
    })
  } else if (gal <= settings.alertYellowGallons) {
    // WARNING: at or below yellow threshold
    alerts.push({
      level:   "warning",
      title:   "Inventario bajo",
      message: `Combustible en ${gal.toFixed(0)} gal — por debajo del nivel de alerta (${settings.alertYellowGallons} gal). Considera reabastecer.`,
      link:    "/inventario",
    })
  }

  // WARNING: overdue invoices
  if (kpis.invoicesOverdue > 0) {
    alerts.push({
      level:   "warning",
      title:   `${kpis.invoicesOverdue} factura${kpis.invoicesOverdue !== 1 ? "s" : ""} vencida${kpis.invoicesOverdue !== 1 ? "s" : ""}`,
      message: "Hay facturas con fecha de vencimiento expirada. Contacta a los clientes.",
      link:    "/facturas?status=OVERDUE",
      count:   kpis.invoicesOverdue,
    })
  }

  // WARNING: high pending balance
  if (kpis.pendingBalance > 500_000) {
    alerts.push({
      level:   "warning",
      title:   "Alto saldo pendiente por cobrar",
      message: `RD$${kpis.pendingBalance.toLocaleString("es-DO", { maximumFractionDigits: 0 })} en cuentas abiertas. Revisa el estado de cobros.`,
      link:    "/cobros",
    })
  }

  // All clear
  if (alerts.length === 0) {
    alerts.push({
      level:   "ok",
      title:   "Todo funcionando correctamente",
      message: "No hay alertas activas. El negocio opera con normalidad.",
      link:    "/reportes",
    })
  }

  return alerts
}

export async function getTopCustomers(
  range: DateRange,
  limit = 10,
): Promise<TopCustomer[]> {
  const rows = await prisma.supply.findMany({
    where:  { suppliedAt: { gte: range.from, lte: range.to } },
    select: { customerId: true, total: true, gallons: true },
  })
  if (rows.length === 0) return []

  const map: Record<string, { revenue: number; gallons: number }> = {}
  for (const r of rows) {
    if (!map[r.customerId]) map[r.customerId] = { revenue: 0, gallons: 0 }
    map[r.customerId].revenue  += r.total.toNumber()
    map[r.customerId].gallons  += r.gallons.toNumber()
  }

  const ids = Object.keys(map)
  const customers = await prisma.customer.findMany({
    where:  { id: { in: ids } },
    select: { id: true, name: true },
  })
  const nameMap: Record<string, string> = {}
  for (const c of customers) nameMap[c.id] = c.name

  return Object.entries(map)
    .map(([id, v]) => ({ customerId: id, customerName: nameMap[id] ?? "—", ...v, rank: 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((item, i) => ({ ...item, rank: i + 1 }))
}

/** Dashboard 2.0 entry point — ONE call, everything in parallel */
export async function buildDashboardData(): Promise<DashboardData> {
  const now      = new Date()
  const last30: DateRange = {
    from:  new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to:    now,
    label: "Últimos 30 días",
  }
  const monthRange = getDateRange("month")

  // Fetch settings first — passed to getInventoryStatus() and generateAlerts()
  // to avoid fetching the settings row more than once per request.
  const settings = await getSystemSettings()

  const [
    kpis, inventory, activity,
    topCustomers, customerDebt, truckActivity,
    salesLast30, collectionsLast30, gallonsLast30, inventoryLast30,
    pendingBalanceAgg,
  ] = await Promise.all([
    getDashboardKPIs(),
    getInventoryStatus(settings),   // pass settings — no second DB fetch
    getActivityFeed(20),
    getTopCustomers(monthRange, 10),
    getCustomerDebtReport(),
    getTruckActivityReport(monthRange),
    getSalesByDay(last30),
    getCollectionsByDay(last30),
    getGallonsByDay(last30),
    getInventoryOverTime(last30),
    prisma.invoice.aggregate({
      where: { status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
      _sum:  { balanceDue: true },
    }),
  ])

  const pendingBalance = pendingBalanceAgg._sum.balanceDue?.toNumber() ?? 0
  const extKpis: DashboardExtendedKPIs = { ...kpis, pendingBalance }
  const alerts = generateAlerts(extKpis, inventory, settings)  // uses settings thresholds

  return {
    kpis:          extKpis,
    inventory,
    activity,
    alerts,
    topCustomers,
    customerDebt:  customerDebt.slice(0, 8),
    truckActivity: truckActivity.slice(0, 6),
    charts: { salesLast30, collectionsLast30, gallonsLast30, inventoryLast30 },
  }
}

/** Build report for an explicit ISO date range (YYYY-MM-DD strings) */
export async function buildReportByRange(from: string, to: string): Promise<FullReport> {
  const range: DateRange = {
    from:  new Date(from + "T00:00:00.000Z"),
    to:    new Date(to   + "T23:59:59.999Z"),
    label: `${from} – ${to}`,
  }
  const [
    kpis, sales, collections, inventory,
    customerDebt, invoiceStatus, truckActivity,
    salesByDay, collectionsByDay, gallonsByDay, inventoryOverTime,
  ] = await Promise.all([
    getDashboardKPIs(),
    getSalesMetrics(range),
    getCollectionsMetrics(range),
    getInventoryReport(range),
    getCustomerDebtReport(),
    getInvoiceStatusReport(range),
    getTruckActivityReport(range),
    getSalesByDay(range),
    getCollectionsByDay(range),
    getGallonsByDay(range),
    getInventoryOverTime(range),
  ])
  return {
    period: "month",
    dateRange: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    kpis,
    sales,
    collections,
    inventory,
    customerDebt,
    invoiceStatus,
    truckActivity,
    charts: { salesByDay, collectionsByDay, gallonsByDay, inventoryOverTime },
  }
}

/** Main entry point — calls all computations in parallel */
export async function buildFullReport(period: Period): Promise<FullReport> {
  const range = getDateRange(period)

  const [
    kpis, sales, collections, inventory,
    customerDebt, invoiceStatus, truckActivity,
    salesByDay, collectionsByDay, gallonsByDay, inventoryOverTime,
  ] = await Promise.all([
    getDashboardKPIs(),
    getSalesMetrics(range),
    getCollectionsMetrics(range),
    getInventoryReport(range),
    getCustomerDebtReport(),
    getInvoiceStatusReport(range),
    getTruckActivityReport(range),
    getSalesByDay(range),
    getCollectionsByDay(range),
    getGallonsByDay(range),
    getInventoryOverTime(range),
  ])

  return {
    period,
    dateRange: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    kpis,
    sales,
    collections,
    inventory,
    customerDebt,
    invoiceStatus,
    truckActivity,
    charts: { salesByDay, collectionsByDay, gallonsByDay, inventoryOverTime },
  }
}
