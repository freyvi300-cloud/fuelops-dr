"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { MovementType } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MovementFormData {
  type: MovementType
  gallons: number
  costPerGallon?: number | null
  reference?: string | null
  description?: string | null
  movedAt: string // ISO date string from the form date input
}

export interface SerializedMovement {
  id: string
  gallons: number
  type: string
  description: string | null
  reference: string | null
  costPerGallon: number | null
  movedAt: string
  createdAt: string
}

export interface InventoryStats {
  availableGallons: number
  receivedThisMonth: number
  soldThisMonth: number
  lastMovement: {
    type: string
    gallons: number
    movedAt: string
    description: string | null
  } | null
}

// ─── Balance computation ──────────────────────────────────────────────────────

/**
 * IN  → adds gallons to stock
 * OUT → removes gallons from stock
 * ADJUSTMENT → adds signed gallons (can be negative to correct downward)
 */
function computeBalance(rows: { type: string; gallons: { toNumber(): number } }[]): number {
  return rows.reduce((sum, m) => {
    const g = m.gallons.toNumber()
    if (m.type === "IN")  return sum + g
    if (m.type === "OUT") return sum - g
    if (m.type === "ADJUSTMENT") return sum + g  // stored with sign
    return sum
  }, 0)
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getInventoryMovements(): Promise<SerializedMovement[]> {
  const rows = await prisma.inventoryMovement.findMany({
    orderBy: { movedAt: "desc" },
  })
  return rows.map(r => ({
    id:           r.id,
    gallons:      r.gallons.toNumber(),
    type:         r.type,
    description:  r.description,
    reference:    r.reference,
    costPerGallon: r.costPerGallon?.toNumber() ?? null,
    movedAt:      r.movedAt.toISOString(),
    createdAt:    r.createdAt.toISOString(),
  }))
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [allRows, monthRows, lastMovement] = await Promise.all([
    prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } }),
    prisma.inventoryMovement.findMany({
      where: { movedAt: { gte: firstOfMonth } },
      select: { type: true, gallons: true },
    }),
    prisma.inventoryMovement.findFirst({
      orderBy: { movedAt: "desc" },
      select: { type: true, gallons: true, movedAt: true, description: true },
    }),
  ])

  const availableGallons   = computeBalance(allRows)
  const receivedThisMonth  = monthRows.filter(r => r.type === "IN").reduce((s, r) => s + r.gallons.toNumber(), 0)
  const soldThisMonth      = monthRows.filter(r => r.type === "OUT").reduce((s, r) => s + r.gallons.toNumber(), 0)

  return {
    availableGallons,
    receivedThisMonth,
    soldThisMonth,
    lastMovement: lastMovement
      ? {
          type:        lastMovement.type,
          gallons:     lastMovement.gallons.toNumber(),
          movedAt:     lastMovement.movedAt.toISOString(),
          description: lastMovement.description,
        }
      : null,
  }
}

export async function getCurrentBalance(): Promise<number> {
  const rows = await prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } })
  return computeBalance(rows)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createMovement(data: MovementFormData) {
  // Validate: positive gallons for IN
  if (data.type === MovementType.IN && data.gallons <= 0) {
    throw new Error("Los galones deben ser un número positivo mayor a cero.")
  }

  // Validate: OUT cannot drop balance below zero
  if (data.type === MovementType.OUT) {
    const balance = await getCurrentBalance()
    if (data.gallons > balance) {
      throw new Error(
        `Stock insuficiente. Disponible: ${balance.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`
      )
    }
    if (data.gallons <= 0) {
      throw new Error("Los galones de salida deben ser positivos.")
    }
  }

  // Validate: ADJUSTMENT — check result won't be negative
  if (data.type === MovementType.ADJUSTMENT) {
    const balance = await getCurrentBalance()
    const result = balance + data.gallons  // gallons can be negative for downward adjustment
    if (result < 0) {
      throw new Error(
        `El ajuste dejaría el inventario en negativo. Disponible: ${balance.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`
      )
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      type:          data.type,
      gallons:       data.gallons,
      description:   data.description?.trim() || null,
      reference:     data.reference?.trim()   || null,
      costPerGallon: data.costPerGallon && data.costPerGallon > 0 ? data.costPerGallon : null,
      movedAt:       new Date(data.movedAt),
    },
  })
  revalidatePath("/inventario")
}

/** Called automatically when a supply (suministro) is confirmed */
export async function recordOutMovement(gallons: number, reference: string, description: string) {
  const balance = await getCurrentBalance()
  if (gallons > balance) {
    throw new Error(`Stock insuficiente. Disponible: ${balance.toFixed(2)} gal`)
  }
  await prisma.inventoryMovement.create({
    data: {
      type:        MovementType.OUT,
      gallons,
      reference,
      description,
      movedAt:     new Date(),
    },
  })
  revalidatePath("/inventario")
}
