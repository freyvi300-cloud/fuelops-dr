/**
 * FuelOps-DR — Reporting Engine
 *
 * Single source of truth for all business calculations.
 * Used by: dashboard, /reportes page, email summaries, future PDF/Excel exports.
 *
 * NEVER duplicate these calculations elsewhere.
 * If a new view needs data, add a function here and call it.
 */

import { prisma }                    from "@/lib/prisma"
import { computeInventoryBalance }   from "@/lib/inventory-utils"
import { InvoiceStatus }             from "@prisma/client"

// ═══════════════════════════════════════════════════════════════════════════════
// DATE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export type Period = "today" | "week" | "month" | "year"

export interface DateRange {
  from:  Date
  to:    Date
  label: string
}

export function getDateRange(period: Period): DateRange {
  const now     = new Date()
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const from    = new Date(todayMs)
  const to      = new Date(todayMs + 24 * 60 * 60 * 1000 - 1) // end of today

  if (period === "today") {
    return { from, to, label: "Hoy" }
  }
  if (period === "week") {
    const startOfWeek = new Date(from)
    startOfWeek.setDate(from.getDate() - from.getDay())
    return { from: startOfWeek, to, label: "Esta semana" }
  }
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to, label: "Este mes" }
  }
  // year
  return { from: new Date(now.getFullYear(), 0, 1), to, label: "Este año" }
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
  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    todaySales, monthSales,
    todayPayments, monthPayments,
    allMovements,
    activeCustomers,
    invoicesPending, invoicesOverdue,
  ] = await Promise.all([
    // Sales today/month
    prisma.supply.aggregate({
      where: { suppliedAt: { gte: todayStart } },
      _sum: { total: true, gallons: true },
    }),
    prisma.supply.aggregate({
      where: { suppliedAt: { gte: monthStart } },
      _sum: { total: true, gallons: true },
    }),
    // Collections today/month
    prisma.payment.aggregate({
      where: { paymentDate: { gte: todayStart } },
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

/** Default tank capacity. TODO Phase 2: read from SystemSettings model */
const DEFAULT_TANK_CAPACITY = 20_000 // gallons

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

export async function getInventoryStatus(): Promise<InventoryStatus> {
  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysElapsed = Math.max(1, now.getDate())

  const [allMovements, todayOut, monthOut] = await Promise.all([
    prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } }),
    prisma.inventoryMovement.aggregate({
      where: { type: "OUT", movedAt: { gte: todayStart } },
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
  const percentage          = DEFAULT_TANK_CAPACITY > 0
    ? Math.min(100, (available / DEFAULT_TANK_CAPACITY) * 100)
    : 0
  const estimatedDaysLeft   = avgDailyConsumption > 0
    ? Math.floor(available / avgDailyConsumption)
    : Infinity

  return {
    available, tankCapacity: DEFAULT_TANK_CAPACITY, percentage,
    consumedToday, consumedThisMonth, avgDailyConsumption, estimatedDaysLeft,
  }
}

export async function getActivityFeed(limit = 20): Promise<ActivityItem[]> {
  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [supplies, payments] = await Promise.all([
    prisma.supply.findMany({
      where:   { suppliedAt: { gte: todayStart } },
      include: {
        customer: { select: { name: true } },
        truck:    { select: { code: true } },
        invoice:  { select: { invoiceNumber: true } },
      },
      orderBy: { suppliedAt: "desc" },
      take:    limit,
    }),
    prisma.payment.findMany({
      where:   { paymentDate: { gte: todayStart } },
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

/** Pure function — no DB queries. Call after fetching kpis + inventory. */
export function generateAlerts(
  kpis: DashboardExtendedKPIs,
  inventory: InventoryStatus,
): Alert[] {
  const alerts: Alert[] = []

  // CRITICAL: inventory < 15%
  if (inventory.percentage < 15) {
    const days = inventory.estimatedDaysLeft === Infinity ? "" : ` Estimado: ${inventory.estimatedDaysLeft} días restantes.`
    alerts.push({
      level:   "critical",
      title:   "Inventario crítico",
      message: `Solo quedan ${inventory.available.toFixed(0)} gal (${inventory.percentage.toFixed(1)}% del tanque).${days}`,
      link:    "/inventario",
    })
  } else if (inventory.percentage < 30) {
    alerts.push({
      level:   "warning",
      title:   "Inventario bajo",
      message: `Combustible al ${inventory.percentage.toFixed(1)}%. Considera reabastecer pronto.`,
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

  const [
    kpis, inventory, activity,
    topCustomers, customerDebt, truckActivity,
    salesLast30, collectionsLast30, gallonsLast30, inventoryLast30,
    pendingBalanceAgg,
  ] = await Promise.all([
    getDashboardKPIs(),
    getInventoryStatus(),
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
  const alerts = generateAlerts(extKpis, inventory)

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
