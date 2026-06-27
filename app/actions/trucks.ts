"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { TruckStatus, TruckType } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TruckFormData {
  customerId: string
  code: string
  name: string
  plate?: string | null
  type: TruckType
  status?: TruckStatus
  notes?: string | null
}

export interface SerializedTruck {
  id: string
  customerId: string
  customerName: string
  code: string
  name: string
  plate: string | null
  type: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TruckStats {
  total: number
  active: number
  inactive: number
  customersWithTrucks: number
}

function serialize(t: {
  id: string; customerId: string; code: string; name: string
  plate: string | null; type: string; status: string; notes: string | null
  createdAt: Date; updatedAt: Date
  customer: { name: string }
}): SerializedTruck {
  return {
    id:           t.id,
    customerId:   t.customerId,
    customerName: t.customer.name,
    code:         t.code,
    name:         t.name,
    plate:        t.plate,
    type:         t.type,
    status:       t.status,
    notes:        t.notes,
    createdAt:    t.createdAt.toISOString(),
    updatedAt:    t.updatedAt.toISOString(),
  }
}

// ─── Code generation ──────────────────────────────────────────────────────────

/** Returns the next available code in H001, H002 … sequence */
export async function getNextTruckCode(): Promise<string> {
  const trucks = await prisma.truck.findMany({ select: { code: true } })
  let max = 0
  for (const { code } of trucks) {
    const m = code.match(/^H(\d+)$/i)
    if (m) { const n = parseInt(m[1]); if (n > max) max = n }
  }
  return `H${String(max + 1).padStart(3, "0")}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTrucks(search?: string): Promise<SerializedTruck[]> {
  const trucks = await prisma.truck.findMany({
    where: search ? {
      OR: [
        { code:           { contains: search, mode: "insensitive" } },
        { name:           { contains: search, mode: "insensitive" } },
        { plate:          { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ],
    } : undefined,
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return trucks.map(serialize)
}

export async function getTruckStats(): Promise<TruckStats> {
  const [total, active, inactive, customersWithTrucks] = await Promise.all([
    prisma.truck.count(),
    prisma.truck.count({ where: { status: TruckStatus.ACTIVE } }),
    prisma.truck.count({ where: { status: TruckStatus.INACTIVE } }),
    prisma.truck.groupBy({ by: ["customerId"] }).then((r) => r.length),
  ])
  return { total, active, inactive, customersWithTrucks }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTruck(data: TruckFormData) {
  // Validate unique code
  const existing = await prisma.truck.findUnique({ where: { code: data.code.toUpperCase().trim() } })
  if (existing) throw new Error(`El código "${data.code}" ya está en uso.`)

  await prisma.truck.create({
    data: {
      customerId: data.customerId,
      code:       data.code.toUpperCase().trim(),
      name:       data.name.trim(),
      plate:      data.plate?.toUpperCase().trim() || null,
      type:       data.type,
      status:     TruckStatus.ACTIVE,
      notes:      data.notes?.trim() || null,
    },
  })
  revalidatePath("/camiones")
}

export async function updateTruck(id: string, data: TruckFormData) {
  // Validate unique code (exclude self)
  const existing = await prisma.truck.findFirst({
    where: { code: data.code.toUpperCase().trim(), NOT: { id } },
  })
  if (existing) throw new Error(`El código "${data.code}" ya está en uso.`)

  await prisma.truck.update({
    where: { id },
    data: {
      customerId: data.customerId,
      code:       data.code.toUpperCase().trim(),
      name:       data.name.trim(),
      plate:      data.plate?.toUpperCase().trim() || null,
      type:       data.type,
      status:     data.status ?? TruckStatus.ACTIVE,
      notes:      data.notes?.trim() || null,
    },
  })
  revalidatePath("/camiones")
}

export async function deactivateTruck(id: string) {
  await prisma.truck.update({ where: { id }, data: { status: TruckStatus.INACTIVE } })
  revalidatePath("/camiones")
}

export async function activateTruck(id: string) {
  await prisma.truck.update({ where: { id }, data: { status: TruckStatus.ACTIVE } })
  revalidatePath("/camiones")
}
