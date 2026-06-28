"use server"

import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoiceStats {
  totalBilled:      number   // SUM(total) where not CANCELLED
  totalPending:     number   // SUM(balanceDue) where status ∈ PENDING|PARTIALLY_PAID|OVERDUE
  countPending:     number   // COUNT where status = PENDING
  countOverdue:     number   // COUNT where status = OVERDUE
}

export interface SerializedInvoice {
  id:            string
  invoiceNumber: string
  customerId:    string
  customerName:  string
  customerPhone: string | null
  truckCode:     string | null
  truckName:     string | null
  // Financial
  subtotal:      number
  tax:           number
  discount:      number
  total:         number
  amountPaid:    number
  balanceDue:    number
  // Status
  status:        string
  issueDate:     string
  dueDate:       string | null
  notes:         string | null
  // Supply snapshot
  gallons:       number
  pricePerGallon:number
  paymentType:   string
  createdAt:     string
  updatedAt:     string
}

export interface InvoicePaymentEntry {
  id:            string
  paymentNumber: string
  amount:        number
  paymentMethod: string
  reference:     string | null
  paymentDate:   string
}

export interface SerializedInvoiceDetail extends SerializedInvoice {
  customerAddress: string | null
  customerRnc:     string | null
  customerEmail:   string | null
  truckPlate:      string | null
  truckType:       string | null
  meterPhotoB64:   string | null   // heavy — only loaded for detail view
  supplyNotes:     string | null
  supplyId:        string
  payments:        InvoicePaymentEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeInvoice(r: {
  id: string; invoiceNumber: string; customerId: string; status: string
  subtotal: { toNumber(): number }; tax: { toNumber(): number }; discount: { toNumber(): number }
  total: { toNumber(): number }; amountPaid: { toNumber(): number }; balanceDue: { toNumber(): number }
  issueDate: Date; dueDate: Date | null; notes: string | null; createdAt: Date; updatedAt: Date
  customer: { name: string; phone: string | null }
  truck: { code: string; name: string } | null
  supply: { gallons: { toNumber(): number }; pricePerGallon: { toNumber(): number }; paymentType: string }
}): SerializedInvoice {
  return {
    id:             r.id,
    invoiceNumber:  r.invoiceNumber,
    customerId:     r.customerId,
    customerName:   r.customer.name,
    customerPhone:  r.customer.phone,
    truckCode:      r.truck?.code ?? null,
    truckName:      r.truck?.name ?? null,
    subtotal:       r.subtotal.toNumber(),
    tax:            r.tax.toNumber(),
    discount:       r.discount.toNumber(),
    total:          r.total.toNumber(),
    amountPaid:     r.amountPaid.toNumber(),
    balanceDue:     r.balanceDue.toNumber(),
    status:         r.status,
    issueDate:      r.issueDate.toISOString(),
    dueDate:        r.dueDate?.toISOString() ?? null,
    notes:          r.notes,
    gallons:        r.supply.gallons.toNumber(),
    pricePerGallon: r.supply.pricePerGallon.toNumber(),
    paymentType:    r.supply.paymentType,
    createdAt:      r.createdAt.toISOString(),
    updatedAt:      r.updatedAt.toISOString(),
  }
}

// ─── Auto-update overdue invoices ─────────────────────────────────────────────

async function markOverdueInvoices() {
  await prisma.invoice.updateMany({
    where: {
      status:  { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
      dueDate: { lt: new Date() },
    },
    data: { status: InvoiceStatus.OVERDUE },
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getInvoices(
  search?: string,
  statusFilter?: string,
): Promise<SerializedInvoice[]> {
  // Auto-mark overdue invoices on every page load (replaces a cron job for MVP)
  await markOverdueInvoices()

  const where: Record<string, unknown> = {}
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter as InvoiceStatus
  }
  if (search) {
    const q = search.trim()
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { truck:    { code: { contains: q, mode: "insensitive" } } },
    ]
  }

  const rows = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true } },
      truck:    { select: { code: true, name: true } },
      supply:   { select: { gallons: true, pricePerGallon: true, paymentType: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return rows.map(serializeInvoice)
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  await markOverdueInvoices()

  const [billed, pendingRows, countPending, countOverdue] = await Promise.all([
    // Total billed (all non-cancelled)
    prisma.invoice.aggregate({
      where:  { status: { not: InvoiceStatus.CANCELLED } },
      _sum:   { total: true },
    }),
    // Pending amount (balance due across all open invoices)
    prisma.invoice.aggregate({
      where:  { status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
      _sum:   { balanceDue: true },
    }),
    prisma.invoice.count({ where: { status: InvoiceStatus.PENDING } }),
    prisma.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
  ])

  return {
    totalBilled:  billed._sum.total?.toNumber()          ?? 0,
    totalPending: pendingRows._sum.balanceDue?.toNumber() ?? 0,
    countPending,
    countOverdue,
  }
}

export async function getInvoiceById(id: string): Promise<SerializedInvoiceDetail | null> {
  const r = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      truck:    true,
      supply:   true,
      payments: { orderBy: { paymentDate: "asc" } },
    },
  })
  if (!r) return null

  return {
    ...serializeInvoice({
      ...r,
      customer: { name: r.customer.name, phone: r.customer.phone },
      truck:    r.truck ? { code: r.truck.code, name: r.truck.name } : null,
      supply:   r.supply,
    }),
    customerAddress: r.customer.address,
    customerRnc:     r.customer.rnc,
    customerEmail:   r.customer.email,
    truckPlate:      r.truck?.plate ?? null,
    truckType:       r.truck?.type  ?? null,
    meterPhotoB64:   r.supply.meterPhotoB64,
    supplyNotes:     r.supply.notes,
    supplyId:        r.supply.id,
    payments:        r.payments.map(p => ({
      id:            p.id,
      paymentNumber: p.paymentNumber,
      amount:        p.amount.toNumber(),
      paymentMethod: p.paymentMethod,
      reference:     p.reference,
      paymentDate:   p.paymentDate.toISOString(),
    })),
  }
}

/** Used by the payment registration form to show pending invoices for a customer */
export async function getCustomerPendingInvoices(customerId: string): Promise<SerializedInvoice[]> {
  await markOverdueInvoices()
  const rows = await prisma.invoice.findMany({
    where: {
      customerId,
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      truck:    { select: { code: true, name: true } },
      supply:   { select: { gallons: true, pricePerGallon: true, paymentType: true } },
    },
    orderBy: { issueDate: "asc" },
  })
  return rows.map(serializeInvoice)
}
