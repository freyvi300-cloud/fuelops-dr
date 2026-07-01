"use server"

import { prisma }             from "@/lib/prisma"
import { InvoiceStatus }      from "@prisma/client"
import { resolveCustomerPrice } from "@/lib/pricing"
import { getSystemSettings }  from "@/lib/system-settings"

// ─── Exported types ───────────────────────────────────────────────────────────

export interface CustomerSupplyItem {
  id:             string
  suppliedAt:     string
  truckId:        string | null
  truckCode:      string | null
  truckName:      string | null
  gallons:        number
  pricePerGallon: number
  total:          number
  paymentType:    "CASH" | "CREDIT"
  notes:          string | null
  invoiceNumber:  string | null
}

export interface CustomerInvoiceItem {
  id:             string
  invoiceNumber:  string
  truckCode:      string | null
  truckName:      string | null
  gallons:        number
  pricePerGallon: number
  total:          number
  amountPaid:     number
  balanceDue:     number
  status:         "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED"
  issueDate:      string
  dueDate:        string | null
  paymentType:    "CASH" | "CREDIT"
}

export interface CustomerPaymentItem {
  id:            string
  paymentNumber: string
  invoiceId:     string | null
  invoiceNumber: string | null
  amount:        number
  paymentMethod: "CASH" | "TRANSFER" | "BANK_DEPOSIT" | "CHECK" | "OTHER"
  reference:     string | null
  notes:         string | null
  paymentDate:   string
  createdAt:     string  // exact DB registration time
}

export interface CustomerTruckItem {
  id:            string
  code:          string
  name:          string
  plate:         string | null
  type:          string
  status:        string
  gallonsBilled: number
  pctOfTotal:    number
  notes:         string | null
}

export interface CustomerDetailData {
  // Core
  id:                      string
  name:                    string
  phone:                   string | null
  email:                   string | null
  address:                 string | null
  rnc:                     string | null
  status:                  string
  notes:                   string | null
  createdAt:               string
  // Pricing
  priceType:               "FIXED" | "DISCOUNT_PCT"
  fuelPricePerGallon:      number
  priceDiscount:           number
  effectivePricePerGallon: number
  creditLimit:             number
  // KPIs (computed from live data)
  debtActual:              number   // = customer.currentBalance (authoritative)
  pendingGallonsComputed:  number   // sum of gallons from open invoices
  pendingInvoicesCount:    number
  overdueInvoicesCount:    number
  // Related data
  supplies:       CustomerSupplyItem[]
  invoicesAll:    CustomerInvoiceItem[]
  invoicesPending:CustomerInvoiceItem[]
  payments:       CustomerPaymentItem[]
  trucks:         CustomerTruckItem[]
  // Payment summary
  totalPaid:           number
  totalPaidThisMonth:  number
  lastPayment:         CustomerPaymentItem | null
  paymentCount:        number
}

// ─── Helper: mark overdue invoices for this customer ─────────────────────────

async function markOverdueForCustomer(customerId: string) {
  await prisma.invoice.updateMany({
    where: {
      customerId,
      status:  { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
      dueDate: { lt: new Date() },
    },
    data: { status: InvoiceStatus.OVERDUE },
  })
}

// ─── Main action ─────────────────────────────────────────────────────────────

export async function getCustomerDetailData(
  id: string,
): Promise<CustomerDetailData | null> {
  // Keep overdue status fresh
  await markOverdueForCustomer(id)

  const [raw, settings] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        trucks: { orderBy: { createdAt: "asc" } },

        supplies: {
          include: {
            truck:   { select: { code: true, name: true } },
            invoice: { select: { invoiceNumber: true } },
          },
          orderBy: { suppliedAt: "desc" },
        },

        invoices: {
          include: {
            truck:  { select: { code: true, name: true } },
            supply: { select: { gallons: true, pricePerGallon: true, paymentType: true } },
          },
          orderBy: { issueDate: "desc" },
        },

        payments: {
          include: {
            invoice: { select: { invoiceNumber: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getSystemSettings(),
  ])

  if (!raw) return null

  // ── Pricing ──────────────────────────────────────────────────────────────
  const priceType          = raw.priceType as "FIXED" | "DISCOUNT_PCT"
  const fuelPricePerGallon = raw.fuelPricePerGallon.toNumber()
  const priceDiscount      = raw.priceDiscount.toNumber()
  const effectivePrice     = resolveCustomerPrice(
    { priceType, fuelPricePerGallon, priceDiscount },
    settings.defaultFuelPrice,
  )

  // ── Supplies ─────────────────────────────────────────────────────────────
  const supplies: CustomerSupplyItem[] = raw.supplies.map(s => ({
    id:             s.id,
    suppliedAt:     s.suppliedAt.toISOString(),
    truckId:        s.truckId,
    truckCode:      s.truck?.code ?? null,
    truckName:      s.truck?.name ?? null,
    gallons:        s.gallons.toNumber(),
    pricePerGallon: s.pricePerGallon.toNumber(),
    total:          s.total.toNumber(),
    paymentType:    s.paymentType as "CASH" | "CREDIT",
    notes:          s.notes,
    invoiceNumber:  s.invoice?.invoiceNumber ?? null,
  }))

  // ── Invoices ─────────────────────────────────────────────────────────────
  const OPEN = new Set<string>(["PENDING", "PARTIALLY_PAID", "OVERDUE"])

  const invoicesAll: CustomerInvoiceItem[] = raw.invoices.map(inv => ({
    id:             inv.id,
    invoiceNumber:  inv.invoiceNumber,
    truckCode:      inv.truck?.code ?? null,
    truckName:      inv.truck?.name ?? null,
    gallons:        inv.supply.gallons.toNumber(),
    pricePerGallon: inv.supply.pricePerGallon.toNumber(),
    total:          inv.total.toNumber(),
    amountPaid:     inv.amountPaid.toNumber(),
    balanceDue:     inv.balanceDue.toNumber(),
    status:         inv.status as CustomerInvoiceItem["status"],
    issueDate:      inv.issueDate.toISOString(),
    dueDate:        inv.dueDate?.toISOString() ?? null,
    paymentType:    inv.supply.paymentType as "CASH" | "CREDIT",
  }))

  const invoicesPending = invoicesAll.filter(inv => OPEN.has(inv.status))

  // ── KPI: pendingGallonsComputed ───────────────────────────────────────────
  const pendingGallonsComputed = invoicesPending.reduce((s, inv) => s + inv.gallons, 0)
  const pendingInvoicesCount   = invoicesPending.length
  const overdueInvoicesCount   = invoicesAll.filter(inv => inv.status === "OVERDUE").length

  // ── Payments ─────────────────────────────────────────────────────────────
  const payments: CustomerPaymentItem[] = raw.payments.map(p => ({
    id:            p.id,
    paymentNumber: p.paymentNumber,
    invoiceId:     p.invoiceId,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    amount:        p.amount.toNumber(),
    paymentMethod: p.paymentMethod as CustomerPaymentItem["paymentMethod"],
    reference:     p.reference,
    notes:         p.notes,
    paymentDate:   p.paymentDate.toISOString(),
    createdAt:     p.createdAt.toISOString(),
  }))

  // ── Payment summary ───────────────────────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalPaid          = payments.reduce((s, p) => s + p.amount, 0)
  const totalPaidThisMonth = payments
    .filter(p => new Date(p.createdAt) >= monthStart)
    .reduce((s, p) => s + p.amount, 0)
  const lastPayment = payments[0] ?? null

  // ── Trucks with supply stats ──────────────────────────────────────────────
  const totalGallons = supplies.reduce((s, sup) => s + sup.gallons, 0)

  const trucks: CustomerTruckItem[] = raw.trucks.map(t => {
    const truckGallons = supplies
      .filter(s => s.truckId === t.id)
      .reduce((s, sup) => s + sup.gallons, 0)
    return {
      id:            t.id,
      code:          t.code,
      name:          t.name,
      plate:         t.plate,
      type:          t.type,
      status:        t.status,
      gallonsBilled: truckGallons,
      pctOfTotal:    totalGallons > 0 ? (truckGallons / totalGallons) * 100 : 0,
      notes:         t.notes,
    }
  })

  return {
    id:                      raw.id,
    name:                    raw.name,
    phone:                   raw.phone,
    email:                   raw.email,
    address:                 raw.address,
    rnc:                     raw.rnc,
    status:                  raw.status,
    notes:                   raw.notes,
    createdAt:               raw.createdAt.toISOString(),
    priceType,
    fuelPricePerGallon,
    priceDiscount,
    effectivePricePerGallon: effectivePrice,
    creditLimit:             raw.creditLimit.toNumber(),
    debtActual:              raw.currentBalance.toNumber(),
    pendingGallonsComputed,
    pendingInvoicesCount,
    overdueInvoicesCount,
    supplies,
    invoicesAll,
    invoicesPending,
    payments,
    trucks,
    totalPaid,
    totalPaidThisMonth,
    lastPayment,
    paymentCount: payments.length,
  }
}
