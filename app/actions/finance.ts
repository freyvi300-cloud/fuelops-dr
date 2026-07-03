"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MethodBreakdown {
  method: string
  label:  string
  amount: number
  count:  number
  pct:    number
}

export interface DayFlow {
  dateLabel: string
  dateISO:   string
  income:    number
  cash:      number
  nonCash:   number
}

export interface ReceivableRow {
  customerId:           string
  customerName:         string
  balance:              number
  lastPaymentDate:      string | null
  daysSinceLastPayment: number | null
}

export interface TopCustomer {
  customerId:   string
  customerName: string
  amount:       number
  count:        number
}

export interface RecentPayment {
  id:            string
  paymentNumber: string
  customerName:  string
  method:        string
  reference:     string | null
  notes:         string | null
  amount:        number
  paymentDate:   string
}

// ─── Bank types ───────────────────────────────────────────────────────────────

export interface BankPayment {
  id:            string
  paymentNumber: string
  customerName:  string
  amount:        number
  reference:     string | null
  notes:         string | null
  paymentDate:   string
  method:        string
}

export interface BankDayFlow {
  dateLabel: string
  dateISO:   string
  amount:    number
}

export interface BankSummary {
  bankName:     string
  totalAmount:  number
  paymentCount: number
  avgPayment:   number
  customers:    string[]
  topCustomer:  { name: string; amount: number } | null
  dailyFlow:    BankDayFlow[]
  payments:     BankPayment[]
}

export interface FinanceDashboardResult {
  kpis: {
    totalIncome:     number
    totalTransfers:  number
    totalCash:       number
    totalPending:    number
    invoicesCount:   number
    gallonsSold:     number
    customersServed: number
  }
  byMethod:       MethodBreakdown[]
  byBank:         BankSummary[]
  dailyFlow:      DayFlow[]
  receivables:    ReceivableRow[]
  topByPurchase:  TopCustomer[]
  topByPayment:   TopCustomer[]
  topByDebt:      TopCustomer[]
  recentPayments: RecentPayment[]
  periodLabel:    string
}

import { detectBank } from "@/lib/bank-detection"

// ─── Method labels ────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  CASH:         "Efectivo",
  TRANSFER:     "Transferencia",
  BANK_DEPOSIT: "Depósito bancario",
  CHECK:        "Cheque",
  OTHER:        "Otro",
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getFinancialDashboard(
  dateFrom:       string,
  dateTo:         string,
  customerId?:    string,
  paymentMethod?: string,
): Promise<FinanceDashboardResult> {
  const from = new Date(dateFrom + "T00:00:00.000Z")
  const to   = new Date(dateTo   + "T23:59:59.999Z")

  const paymentsWhere: Prisma.PaymentWhereInput = {
    paymentDate: { gte: from, lte: to },
    ...(customerId    && { customerId }),
    ...(paymentMethod && { paymentMethod: paymentMethod as never }),
  }

  const suppliesWhere: Prisma.SupplyWhereInput = {
    suppliedAt: { gte: from, lte: to },
    ...(customerId && { customerId }),
  }

  const invoicesWhere: Prisma.InvoiceWhereInput = {
    issueDate: { gte: from, lte: to },
    ...(customerId && { customerId }),
  }

  const [rawPayments, suppliesForTop, invoicesCount, allDebtors] = await Promise.all([
    prisma.payment.findMany({
      where:   paymentsWhere,
      select: {
        id: true, paymentNumber: true, amount: true, paymentMethod: true,
        reference: true, notes: true, paymentDate: true, customerId: true,
        customer: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.supply.findMany({
      where:  suppliesWhere,
      select: {
        customerId: true, total: true, gallons: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.invoice.count({ where: invoicesWhere }),
    prisma.customer.findMany({
      where: {
        currentBalance: { gt: 0 },
        status: "ACTIVE",
        ...(customerId ? { id: customerId } : {}),
      },
      select: {
        id: true, name: true, currentBalance: true,
        payments: {
          orderBy: { paymentDate: "desc" },
          take:    1,
          select:  { paymentDate: true },
        },
      },
      orderBy: { currentBalance: "desc" },
    }),
  ])

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalIncome    = rawPayments.reduce((s, p) => s + p.amount.toNumber(), 0)
  const totalCash      = rawPayments.filter(p => p.paymentMethod === "CASH")
                                    .reduce((s, p) => s + p.amount.toNumber(), 0)
  const totalTransfers = totalIncome - totalCash
  const totalPending   = allDebtors.reduce((s, c) => s + c.currentBalance.toNumber(), 0)
  const gallonsSold    = suppliesForTop.reduce((s, t) => s + t.gallons.toNumber(), 0)
  const customersServed = new Set(suppliesForTop.map(s => s.customerId)).size

  // ── By method ─────────────────────────────────────────────────────────────

  const methodMap = new Map<string, { amount: number; count: number }>()
  for (const p of rawPayments) {
    const m = p.paymentMethod as string
    const e = methodMap.get(m) ?? { amount: 0, count: 0 }
    methodMap.set(m, { amount: e.amount + p.amount.toNumber(), count: e.count + 1 })
  }
  const byMethod: MethodBreakdown[] = Array.from(methodMap.entries())
    .map(([method, d]) => ({
      method,
      label:  METHOD_LABELS[method] ?? method,
      amount: d.amount,
      count:  d.count,
      pct:    totalIncome > 0 ? (d.amount / totalIncome) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // ── By bank ───────────────────────────────────────────────────────────────

  const bankPaymentsMap = new Map<string, { payments: typeof rawPayments; dayMap: Map<string, number> }>()

  for (const p of rawPayments) {
    const bank = detectBank(p.paymentMethod as string, p.reference, p.notes)
    if (!bankPaymentsMap.has(bank)) {
      bankPaymentsMap.set(bank, { payments: [], dayMap: new Map() })
    }
    const entry = bankPaymentsMap.get(bank)!
    entry.payments.push(p)
    const iso = p.paymentDate.toISOString().slice(0, 10)
    entry.dayMap.set(iso, (entry.dayMap.get(iso) ?? 0) + p.amount.toNumber())
  }

  const byBank: BankSummary[] = Array.from(bankPaymentsMap.entries())
    .map(([bankName, { payments, dayMap }]) => {
      const totalAmount = payments.reduce((s, p) => s + p.amount.toNumber(), 0)
      const avgPayment  = payments.length > 0 ? totalAmount / payments.length : 0

      // Top customer by amount paid through this bank
      const custMap = new Map<string, number>()
      for (const p of payments) {
        custMap.set(p.customer.name, (custMap.get(p.customer.name) ?? 0) + p.amount.toNumber())
      }
      const topEntry = Array.from(custMap.entries()).sort((a, b) => b[1] - a[1])[0]
      const topCustomer = topEntry ? { name: topEntry[0], amount: topEntry[1] } : null

      // Daily flow (fill every day in range)
      const dailyFlow: BankDayFlow[] = []
      const cursor = new Date(from)
      while (cursor <= to) {
        const iso = cursor.toISOString().slice(0, 10)
        dailyFlow.push({
          dateISO:   iso,
          dateLabel: cursor.toLocaleDateString("es-DO", { day: "2-digit", month: "short", timeZone: "UTC" }),
          amount:    dayMap.get(iso) ?? 0,
        })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }

      const customers = [...new Set(payments.map(p => p.customer.name))].sort()

      return {
        bankName,
        totalAmount,
        paymentCount: payments.length,
        avgPayment,
        topCustomer,
        customers,
        dailyFlow,
        payments: payments.slice(0, 100).map(p => ({
          id:            p.id,
          paymentNumber: p.paymentNumber,
          customerName:  p.customer.name,
          amount:        p.amount.toNumber(),
          reference:     p.reference,
          notes:         p.notes,
          paymentDate:   p.paymentDate.toISOString(),
          method:        p.paymentMethod as string,
        })),
      }
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)

  // ── Daily flow ────────────────────────────────────────────────────────────

  const flowMap = new Map<string, { income: number; cash: number; nonCash: number }>()
  for (const p of rawPayments) {
    const dateISO = p.paymentDate.toISOString().slice(0, 10)
    const e   = flowMap.get(dateISO) ?? { income: 0, cash: 0, nonCash: 0 }
    const amt = p.amount.toNumber()
    const isCash = p.paymentMethod === "CASH"
    flowMap.set(dateISO, {
      income:  e.income  + amt,
      cash:    e.cash    + (isCash ? amt : 0),
      nonCash: e.nonCash + (isCash ? 0 : amt),
    })
  }

  const dailyFlow: DayFlow[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const iso = cursor.toISOString().slice(0, 10)
    const day = flowMap.get(iso) ?? { income: 0, cash: 0, nonCash: 0 }
    dailyFlow.push({
      dateISO:   iso,
      dateLabel: cursor.toLocaleDateString("es-DO", { day: "2-digit", month: "short", timeZone: "UTC" }),
      ...day,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // ── Top by purchase ────────────────────────────────────────────────────────

  const purchaseMap = new Map<string, { name: string; amount: number; count: number }>()
  for (const s of suppliesForTop) {
    const e = purchaseMap.get(s.customerId) ?? { name: s.customer.name, amount: 0, count: 0 }
    purchaseMap.set(s.customerId, { name: e.name, amount: e.amount + s.total.toNumber(), count: e.count + 1 })
  }
  const topByPurchase: TopCustomer[] = Array.from(purchaseMap.entries())
    .map(([customerId, d]) => ({ customerId, customerName: d.name, amount: d.amount, count: d.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // ── Top by payment ─────────────────────────────────────────────────────────

  const paymentMap = new Map<string, { name: string; amount: number; count: number }>()
  for (const p of rawPayments) {
    const e = paymentMap.get(p.customerId) ?? { name: p.customer.name, amount: 0, count: 0 }
    paymentMap.set(p.customerId, { name: e.name, amount: e.amount + p.amount.toNumber(), count: e.count + 1 })
  }
  const topByPayment: TopCustomer[] = Array.from(paymentMap.entries())
    .map(([customerId, d]) => ({ customerId, customerName: d.name, amount: d.amount, count: d.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // ── Top by debt ────────────────────────────────────────────────────────────

  const topByDebt: TopCustomer[] = allDebtors.slice(0, 5).map(c => ({
    customerId:   c.id,
    customerName: c.name,
    amount:       c.currentBalance.toNumber(),
    count:        0,
  }))

  // ── Receivables ────────────────────────────────────────────────────────────

  const now = new Date()
  const receivables: ReceivableRow[] = allDebtors.map(c => {
    const lastPmt = c.payments[0]?.paymentDate ?? null
    const daysSince = lastPmt
      ? Math.floor((now.getTime() - new Date(lastPmt).getTime()) / 86_400_000)
      : null
    return {
      customerId:           c.id,
      customerName:         c.name,
      balance:              c.currentBalance.toNumber(),
      lastPaymentDate:      lastPmt?.toISOString() ?? null,
      daysSinceLastPayment: daysSince,
    }
  })

  // ── Recent payments ────────────────────────────────────────────────────────

  const recentPayments: RecentPayment[] = rawPayments.slice(0, 30).map(p => ({
    id:            p.id,
    paymentNumber: p.paymentNumber,
    customerName:  p.customer.name,
    method:        p.paymentMethod as string,
    reference:     p.reference,
    notes:         p.notes,
    amount:        p.amount.toNumber(),
    paymentDate:   p.paymentDate.toISOString(),
  }))

  // ── Period label ────────────────────────────────────────────────────────────

  const fmt = (d: Date) =>
    d.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
  const periodLabel = `${fmt(from)} al ${fmt(to)}`

  return {
    kpis: { totalIncome, totalTransfers, totalCash, totalPending, invoicesCount, gallonsSold, customersServed },
    byMethod,
    byBank,
    dailyFlow,
    receivables,
    topByPurchase,
    topByPayment,
    topByDebt,
    recentPayments,
    periodLabel,
  }
}
