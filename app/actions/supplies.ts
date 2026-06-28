"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { PaymentType, InvoiceStatus, Prisma } from "@prisma/client"
import { computeInventoryBalance } from "@/lib/inventory-utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupplyFormData {
  customerId:     string
  truckId?:       string | null
  gallons:        number
  pricePerGallon: number
  paymentType:    "CASH" | "CREDIT"
  meterPhotoB64?: string | null
  notes?:         string | null
}

export interface ConfirmedSupplyResult {
  id:             string
  invoiceNumber:  string   // e.g. INV-000001
  customerName:   string
  truckCode:      string | null
  truckName:      string | null
  gallons:        number
  pricePerGallon: number
  total:          number
  paymentType:    string
  suppliedAt:     string
}

export interface SerializedSupply {
  id:             string
  customerName:   string
  truckCode:      string | null
  truckName:      string | null
  gallons:        number
  pricePerGallon: number
  total:          number
  paymentType:    string
  notes:          string | null
  suppliedAt:     string
}

// ─── Invoice number generation ────────────────────────────────────────────────

async function generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select:  { invoiceNumber: true },
  })
  if (!last) return "INV-000001"
  const match = last.invoiceNumber.match(/INV-(\d+)/)
  if (!match) return "INV-000001"
  const next = parseInt(match[1]) + 1
  return `INV-${String(next).padStart(6, "0")}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getRecentSupplies(limit = 10): Promise<SerializedSupply[]> {
  const rows = await prisma.supply.findMany({
    take: limit,
    orderBy: { suppliedAt: "desc" },
    include: {
      customer: { select: { name: true } },
      truck:    { select: { code: true, name: true } },
    },
  })
  return rows.map(r => ({
    id:             r.id,
    customerName:   r.customer.name,
    truckCode:      r.truck?.code ?? null,
    truckName:      r.truck?.name ?? null,
    gallons:        r.gallons.toNumber(),
    pricePerGallon: r.pricePerGallon.toNumber(),
    total:          r.total.toNumber(),
    paymentType:    r.paymentType,
    notes:          r.notes,
    suppliedAt:     r.suppliedAt.toISOString(),
  }))
}

// ─── Confirm supply — atomic transaction ─────────────────────────────────────

export async function confirmSupply(data: SupplyFormData): Promise<ConfirmedSupplyResult> {
  const { customerId, truckId, gallons, pricePerGallon, paymentType, meterPhotoB64, notes } = data

  // ── Pre-validation ────────────────────────────────────────────────────────
  if (gallons <= 0)        throw new Error("Los galones deben ser mayores a cero.")
  if (pricePerGallon <= 0) throw new Error("El precio por galón debe ser mayor a cero.")

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new Error("Cliente no encontrado.")

  const movements = await prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } })
  const available = computeInventoryBalance(movements)
  if (gallons > available) {
    throw new Error(
      `Stock insuficiente. Disponible: ${available.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`
    )
  }

  const total = gallons * pricePerGallon

  if (paymentType === "CREDIT" && customer.creditLimit.toNumber() > 0) {
    const newBalance = customer.currentBalance.toNumber() + total
    if (newBalance > customer.creditLimit.toNumber()) {
      throw new Error("El total supera el límite de crédito disponible del cliente.")
    }
  }

  // ── Atomic transaction: Supply + InventoryMovement + Customer + Invoice ───
  const supply = await prisma.$transaction(async (tx) => {
    // 1. Create supply
    const created = await tx.supply.create({
      data: {
        customerId,
        truckId:        truckId || null,
        gallons,
        pricePerGallon,
        total,
        paymentType:    paymentType === "CASH" ? PaymentType.CASH : PaymentType.CREDIT,
        meterPhotoB64:  meterPhotoB64 || null,
        notes:          notes?.trim() || null,
      },
      include: {
        customer: { select: { name: true } },
        truck:    { select: { code: true, name: true } },
      },
    })

    // 2. Decrement inventory
    await tx.inventoryMovement.create({
      data: {
        type:        "OUT",
        gallons,
        reference:   `Suministro #${created.id.slice(-6).toUpperCase()}`,
        description: `Cliente: ${customer.name}${created.truck ? ` · ${created.truck.code}` : ""}`,
        supplyId:    created.id,
        movedAt:     new Date(),
      },
    })

    // 3. Update customer balances
    // pendingGallons only increments for CREDIT — CASH is already paid
    await tx.customer.update({
      where: { id: customerId },
      data: {
        ...(paymentType === "CREDIT" && {
          pendingGallons: { increment: gallons },
          currentBalance: { increment: total },
        }),
      },
    })

    // 4. Auto-generate invoice
    const invoiceNumber = await generateInvoiceNumber(tx)
    const isCash        = paymentType === "CASH"
    const dueDate       = isCash ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days

    await tx.invoice.create({
      data: {
        invoiceNumber,
        supplyId:    created.id,
        customerId,
        truckId:     truckId || null,
        subtotal:    total,              // tax/discount = 0 → subtotal = total
        tax:         0,
        discount:    0,
        total,
        amountPaid:  isCash ? total : 0,
        balanceDue:  isCash ? 0     : total,
        status:      isCash ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        issueDate:   new Date(),
        dueDate,
        notes:       null,
      },
    })

    return { created, invoiceNumber }
  })

  // ── Revalidate ────────────────────────────────────────────────────────────
  revalidatePath("/suministro")
  revalidatePath("/inventario")
  revalidatePath("/clientes")
  revalidatePath("/facturas")
  revalidatePath("/")

  return {
    id:             supply.created.id,
    invoiceNumber:  supply.invoiceNumber,
    customerName:   supply.created.customer.name,
    truckCode:      supply.created.truck?.code ?? null,
    truckName:      supply.created.truck?.name ?? null,
    gallons,
    pricePerGallon,
    total,
    paymentType,
    suppliedAt:     supply.created.suppliedAt.toISOString(),
  }
}
