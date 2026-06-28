"use server"

import { prisma }        from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaymentFormData {
  customerId:    string
  invoiceId?:    string | null
  amount:        number
  paymentMethod: string
  reference?:    string | null
  notes?:        string | null
  paymentDate:   string          // ISO string from datetime-local input
}

export interface SerializedPayment {
  id:            string
  paymentNumber: string
  customerId:    string
  customerName:  string
  invoiceId:     string | null
  invoiceNumber: string | null
  amount:        number
  paymentMethod: string
  reference:     string | null
  notes:         string | null
  paymentDate:   string
  createdAt:     string
}

export interface PaymentStats {
  totalToday:           number
  totalThisMonth:       number
  customersWithBalance: number
  partialInvoices:      number
}

export interface PaymentResult {
  paymentNumber: string
  customerName:  string
  invoiceNumber: string | null
  amount:        number
  paymentMethod: string
  paymentDate:   string
}

// ─── Payment number generation ────────────────────────────────────────────────

async function generatePaymentNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.payment.findFirst({
    orderBy: { paymentNumber: "desc" },
    select:  { paymentNumber: true },
  })
  if (!last) return "PAY-000001"
  const match = last.paymentNumber.match(/PAY-(\d+)/)
  if (!match) return "PAY-000001"
  const next = parseInt(match[1]) + 1
  return `PAY-${String(next).padStart(6, "0")}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPayments(): Promise<SerializedPayment[]> {
  const rows = await prisma.payment.findMany({
    include: {
      customer: { select: { name: true } },
      invoice:  { select: { invoiceNumber: true } },
    },
    orderBy: { paymentDate: "desc" },
  })
  return rows.map(r => ({
    id:            r.id,
    paymentNumber: r.paymentNumber,
    customerId:    r.customerId,
    customerName:  r.customer.name,
    invoiceId:     r.invoiceId,
    invoiceNumber: r.invoice?.invoiceNumber ?? null,
    amount:        r.amount.toNumber(),
    paymentMethod: r.paymentMethod,
    reference:     r.reference,
    notes:         r.notes,
    paymentDate:   r.paymentDate.toISOString(),
    createdAt:     r.createdAt.toISOString(),
  }))
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const now     = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayAgg, monthAgg, customersWithBalance, partialInvoices] = await Promise.all([
    prisma.payment.aggregate({
      where: { paymentDate: { gte: todayStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.customer.count({ where: { currentBalance: { gt: 0 } } }),
    prisma.invoice.count({ where: { status: InvoiceStatus.PARTIALLY_PAID } }),
  ])

  return {
    totalToday:           todayAgg._sum.amount?.toNumber()  ?? 0,
    totalThisMonth:       monthAgg._sum.amount?.toNumber()  ?? 0,
    customersWithBalance,
    partialInvoices,
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createPayment(data: PaymentFormData): Promise<PaymentResult> {
  if (data.amount <= 0) throw new Error("El monto debe ser mayor a cero.")

  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } })
  if (!customer) throw new Error("Cliente no encontrado.")

  // Validate against selected invoice
  let invoice = null
  if (data.invoiceId) {
    invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { supply: { select: { gallons: true } } },
    })
    if (!invoice) throw new Error("Factura no encontrada.")
    if (["PAID", "CANCELLED"].includes(invoice.status)) {
      throw new Error("Esta factura ya está pagada o cancelada.")
    }
    const balanceDue = invoice.balanceDue.toNumber()
    if (data.amount > balanceDue + 0.001) {  // small epsilon for floating point
      throw new Error(
        `El monto (${fmtRD(data.amount)}) supera el saldo pendiente (${fmtRD(balanceDue)}).`
      )
    }
  }

  // ── Atomic transaction ─────────────────────────────────────────────────────
  const payment = await prisma.$transaction(async (tx) => {
    // 1. Generate payment number
    const paymentNumber = await generatePaymentNumber(tx)

    // 2. Create payment record
    const created = await tx.payment.create({
      data: {
        paymentNumber,
        customerId:    data.customerId,
        invoiceId:     data.invoiceId || null,
        amount:        data.amount,
        paymentMethod: data.paymentMethod as PaymentMethod,
        reference:     data.reference?.trim() || null,
        notes:         data.notes?.trim()     || null,
        paymentDate:   new Date(data.paymentDate),
      },
      include: { invoice: { select: { invoiceNumber: true } } },
    })

    // 3. Update invoice if specified
    if (invoice && data.invoiceId) {
      const newAmountPaid = invoice.amountPaid.toNumber() + data.amount
      const newBalanceDue = Math.max(0, invoice.total.toNumber() - newAmountPaid)
      const newStatus     = newBalanceDue <= 0.001
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID

      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status:     newStatus,
        },
      })

      // If fully paid, decrement customer pendingGallons by supply gallons
      if (newStatus === InvoiceStatus.PAID && invoice.supply) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            pendingGallons: {
              decrement: invoice.supply.gallons.toNumber(),
            },
          },
        })
      }
    }

    // 4. Decrement customer currentBalance
    await tx.customer.update({
      where: { id: data.customerId },
      data: { currentBalance: { decrement: data.amount } },
    })

    return { created, paymentNumber }
  })

  revalidatePath("/cobros")
  revalidatePath("/facturas")
  revalidatePath("/clientes")
  revalidatePath("/")

  return {
    paymentNumber: payment.paymentNumber,
    customerName:  customer.name,
    invoiceNumber: payment.created.invoice?.invoiceNumber ?? null,
    amount:        data.amount,
    paymentMethod: data.paymentMethod,
    paymentDate:   payment.created.paymentDate.toISOString(),
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
}
