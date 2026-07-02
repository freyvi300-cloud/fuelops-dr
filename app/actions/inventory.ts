"use server"

import { prisma }               from "@/lib/prisma"
import { revalidatePath }       from "next/cache"
import { MovementType }         from "@prisma/client"
import { computeInventoryBalance } from "@/lib/inventory-utils"
import { getSystemSettings }    from "@/lib/system-settings"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MovementFormData {
  type: MovementType
  gallons: number
  costPerGallon?: number | null
  reference?: string | null
  description?: string | null
  movedAt: string
}

export interface SerializedMovement {
  id:           string
  gallons:      number
  type:         string
  description:  string | null
  reference:    string | null
  costPerGallon: number | null
  movedAt:      string
  createdAt:    string
}

export interface ConsumptionPoint {
  date:    string   // "DD/MM"
  salidas: number   // gallons OUT that day
  balance: number   // running inventory balance at end of day
}

export interface InventoryStats {
  availableGallons:    number
  tankCapacity:        number
  fillPct:             number       // 0-100
  alertLevel:          "normal" | "yellow" | "red"
  alertRedGallons:     number
  alertYellowGallons:  number
  receivedThisMonth:   number
  soldThisMonth:       number
  soldThisWeek:        number
  soldToday:           number
  avgDailyConsumption: number       // last 30 days avg
  daysRemaining:       number | null
  lastMovement: {
    type:        string
    gallons:     number
    movedAt:     string
    description: string | null
  } | null
  consumptionChart: ConsumptionPoint[]  // last 30 days
}

// ─── Chart builder ────────────────────────────────────────────────────────────

type RawRow = { type: string; gallons: { toNumber(): number }; movedAt: Date }

function buildConsumptionChart(allRows: RawRow[], now: Date): ConsumptionPoint[] {
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  // 1. Balance at the start of the 30-day window
  let balance = 0
  for (const r of allRows) {
    if (r.movedAt < thirtyDaysAgo) {
      const g = r.gallons.toNumber()
      if (r.type === "IN") balance += g
      else if (r.type === "OUT") balance -= g
      else balance += g  // ADJUSTMENT (can be negative gallons)
    }
  }

  // 2. Build ordered day keys for last 30 days
  const dayKeys: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    dayKeys.push(`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`)
  }

  // 3. Group movements in window by day key
  const byDay: Record<string, { out: number; delta: number }> = {}
  for (const k of dayKeys) byDay[k] = { out: 0, delta: 0 }

  for (const r of allRows) {
    if (r.movedAt < thirtyDaysAgo) continue
    const d   = r.movedAt
    const key = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
    if (!(key in byDay)) continue
    const g = r.gallons.toNumber()
    if (r.type === "OUT") {
      byDay[key].out   += g
      byDay[key].delta -= g
    } else if (r.type === "IN") {
      byDay[key].delta += g
    } else {
      byDay[key].delta += g  // ADJUSTMENT
    }
  }

  // 4. Build chart points with running balance
  return dayKeys.map(date => {
    balance += byDay[date].delta
    return {
      date,
      salidas: Math.round(byDay[date].out * 100) / 100,
      balance: Math.max(0, Math.round(balance * 100) / 100),
    }
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getInventoryMovements(): Promise<SerializedMovement[]> {
  const rows = await prisma.inventoryMovement.findMany({ orderBy: { movedAt: "desc" } })
  return rows.map(r => ({
    id:            r.id,
    gallons:       r.gallons.toNumber(),
    type:          r.type,
    description:   r.description,
    reference:     r.reference,
    costPerGallon: r.costPerGallon?.toNumber() ?? null,
    movedAt:       r.movedAt.toISOString(),
    createdAt:     r.createdAt.toISOString(),
  }))
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const now = new Date()

  const firstOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo  = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)

  const [allRows, settings, lastMovement] = await Promise.all([
    prisma.inventoryMovement.findMany({
      orderBy: { movedAt: "asc" },
      select:  { type: true, gallons: true, movedAt: true },
    }),
    getSystemSettings(),
    prisma.inventoryMovement.findFirst({
      orderBy: { movedAt: "desc" },
      select:  { type: true, gallons: true, movedAt: true, description: true },
    }),
  ])

  // Totals
  const availableGallons  = computeInventoryBalance(allRows)
  const tankCapacity       = Number(settings.tankCapacity)
  const alertRedGallons    = Number(settings.alertRedGallons)
  const alertYellowGallons = Number(settings.alertYellowGallons)

  const outRows   = (arr: RawRow[]) => arr.filter(r => r.type === "OUT").reduce((s, r) => s + r.gallons.toNumber(), 0)
  const inRows    = (arr: RawRow[]) => arr.filter(r => r.type === "IN").reduce((s, r) => s + r.gallons.toNumber(), 0)

  const receivedThisMonth = inRows(allRows.filter(r => r.movedAt >= firstOfMonth))
  const soldThisMonth     = outRows(allRows.filter(r => r.movedAt >= firstOfMonth))
  const soldThisWeek      = outRows(allRows.filter(r => r.movedAt >= sevenDaysAgo))
  const soldToday         = outRows(allRows.filter(r => r.movedAt >= startOfToday))
  const soldLast30        = outRows(allRows.filter(r => r.movedAt >= thirtyDaysAgo))

  const avgDailyConsumption = soldLast30 / 30
  const daysRemaining       = avgDailyConsumption > 0
    ? Math.floor(availableGallons / avgDailyConsumption)
    : null

  const alertLevel: InventoryStats["alertLevel"] =
    availableGallons <= alertRedGallons    ? "red"    :
    availableGallons <= alertYellowGallons ? "yellow" : "normal"

  const fillPct = tankCapacity > 0
    ? Math.min(100, Math.round((availableGallons / tankCapacity) * 100))
    : 0

  const consumptionChart = buildConsumptionChart(allRows, now)

  return {
    availableGallons,
    tankCapacity,
    fillPct,
    alertLevel,
    alertRedGallons,
    alertYellowGallons,
    receivedThisMonth,
    soldThisMonth,
    soldThisWeek,
    soldToday,
    avgDailyConsumption,
    daysRemaining,
    lastMovement: lastMovement
      ? {
          type:        lastMovement.type,
          gallons:     lastMovement.gallons.toNumber(),
          movedAt:     lastMovement.movedAt.toISOString(),
          description: lastMovement.description,
        }
      : null,
    consumptionChart,
  }
}

export async function getCurrentBalance(): Promise<number> {
  const rows = await prisma.inventoryMovement.findMany({ select: { type: true, gallons: true } })
  return computeInventoryBalance(rows)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createMovement(data: MovementFormData) {
  if (data.type === MovementType.IN && data.gallons <= 0)
    throw new Error("Los galones deben ser un número positivo mayor a cero.")

  if (data.type === MovementType.OUT) {
    const balance = await getCurrentBalance()
    if (data.gallons > balance)
      throw new Error(`Stock insuficiente. Disponible: ${balance.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`)
    if (data.gallons <= 0)
      throw new Error("Los galones de salida deben ser positivos.")
  }

  if (data.type === MovementType.ADJUSTMENT) {
    const balance = await getCurrentBalance()
    if (balance + data.gallons < 0)
      throw new Error(`El ajuste dejaría el inventario en negativo. Disponible: ${balance.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`)
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

export async function recordOutMovement(gallons: number, reference: string, description: string) {
  const balance = await getCurrentBalance()
  if (gallons > balance)
    throw new Error(`Stock insuficiente. Disponible: ${balance.toFixed(2)} gal`)
  await prisma.inventoryMovement.create({
    data: { type: MovementType.OUT, gallons, reference, description, movedAt: new Date() },
  })
  revalidatePath("/inventario")
}
