"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { PaymentType } from "@prisma/client"
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

// ─── Confirm supply (atomic transaction) ─────────────────────────────────────

export async function confirmSupply(data: SupplyFormData): Promise<ConfirmedSupplyResult> {
  const { customerId, truckId, gallons, pricePerGallon, paymentType, meterPhotoB64, notes } = data

  // ── Pre-validate outside transaction (better error messages) ──────────────
  if (gallons <= 0) throw new Error("Los galones deben ser mayores a cero.")
  if (pricePerGallon <= 0) throw new Error("El precio por galón debe ser mayor a cero.")

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new Error("Cliente no encontrado.")

  // Inventory check
  const movements = await prisma.inventoryMovement.findMany({
    select: { type: true, gallons: true },
  })
  const available = computeInventoryBalance(movements)
  if (gallons > available) {
    throw new Error(
      `Stock insuficiente. Disponible: ${available.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`
    )
  }

  const total = gallons * pricePerGallon

  // Credit limit check
  if (paymentType === "CREDIT") {
    const newBalance = customer.currentBalance.toNumber() + total
    if (newBalance > customer.creditLimit.toNumber() && customer.creditLimit.toNumber() > 0) {
      throw new Error(
        `El total (${total.toLocaleString("es-DO", { style: "currency", currency: "DOP" })}) supera el límite de crédito disponible del cliente.`
      )
    }
  }

  // ── Atomic transaction ─────────────────────────────────────────────────────
  const supply = await prisma.$transaction(async (tx) => {
    // 1. Create supply record
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

    // 2. Decrement inventory (OUT movement linked to this supply)
    await tx.inventoryMovement.create({
      data: {
        type:        "OUT",
        gallons,
        reference:   `Suministro #${created.id.slice(-6).toUpperCase()}`,
        description: `Cliente: ${customer.name}${created.truck ? ` · Equipo: ${created.truck.code}` : ""}`,
        supplyId:    created.id,
        movedAt:     new Date(),
      },
    })

    // 3. Update customer: pendingGallons always; currentBalance only for CREDIT
    await tx.customer.update({
      where: { id: customerId },
      data: {
        pendingGallons: { increment: gallons },
        ...(paymentType === "CREDIT" && { currentBalance: { increment: total } }),
      },
    })

    return created
  })

  // ── Revalidate affected pages ──────────────────────────────────────────────
  revalidatePath("/suministro")
  revalidatePath("/inventario")
  revalidatePath("/clientes")
  revalidatePath("/")

  return {
    id:             supply.id,
    customerName:   supply.customer.name,
    truckCode:      supply.truck?.code ?? null,
    truckName:      supply.truck?.name ?? null,
    gallons,
    pricePerGallon,
    total,
    paymentType,
    suppliedAt:     supply.suppliedAt.toISOString(),
  }
}
