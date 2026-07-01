"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { CustomerStatus, CustomerPriceType } from "@prisma/client"
import { resolveCustomerPrice } from "@/lib/pricing"
import { getSystemSettings } from "@/lib/system-settings"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomerFormData {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  rnc?: string | null
  creditLimit?: number
  pendingGallons?: number
  priceType?: "FIXED" | "DISCOUNT_PCT"
  fuelPricePerGallon?: number
  priceDiscount?: number
  notes?: string | null
}

export interface SerializedCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  rnc: string | null
  creditLimit: number
  currentBalance: number
  pendingGallons: number
  priceType: "FIXED" | "DISCOUNT_PCT"
  fuelPricePerGallon: number
  priceDiscount: number
  /** Resolved at read-time using current SystemSettings.defaultFuelPrice — NOT stored */
  effectivePricePerGallon: number
  /** Calculated: pendingGallons × effectivePricePerGallon — never stored */
  totalPending: number
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerStats {
  total: number
  active: number
  inactive: number
  totalPendingGallons: number
  totalPendingAmount: number
  avgPricePerGallon: number
}

function serialize(c: {
  id: string; name: string; phone: string | null; email: string | null
  address: string | null; rnc: string | null
  creditLimit: { toNumber(): number }; currentBalance: { toNumber(): number }
  pendingGallons: { toNumber(): number }; fuelPricePerGallon: { toNumber(): number }
  priceType: string; priceDiscount: { toNumber(): number }
  status: string; notes: string | null; createdAt: Date; updatedAt: Date
}, baseFuelPrice: number): SerializedCustomer {
  const gallons       = c.pendingGallons.toNumber()
  const fixedPrice     = c.fuelPricePerGallon.toNumber()
  const priceDiscount  = c.priceDiscount.toNumber()
  const priceType      = c.priceType as "FIXED" | "DISCOUNT_PCT"
  const effectivePrice = resolveCustomerPrice(
    { priceType, fuelPricePerGallon: fixedPrice, priceDiscount },
    baseFuelPrice,
  )
  return {
    id:                      c.id,
    name:                    c.name,
    phone:                   c.phone,
    email:                   c.email,
    address:                 c.address,
    rnc:                     c.rnc,
    creditLimit:             c.creditLimit.toNumber(),
    currentBalance:          c.currentBalance.toNumber(),
    pendingGallons:          gallons,
    priceType,
    fuelPricePerGallon:      fixedPrice,
    priceDiscount,
    effectivePricePerGallon: effectivePrice,
    totalPending:            gallons * effectivePrice,
    status:                  c.status,
    notes:                   c.notes,
    createdAt:               c.createdAt.toISOString(),
    updatedAt:               c.updatedAt.toISOString(),
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string): Promise<SerializedCustomer[]> {
  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: search ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { rnc:   { contains: search, mode: "insensitive" } },
        ],
      } : undefined,
      orderBy: { createdAt: "desc" },
    }),
    getSystemSettings(),
  ])
  return customers.map(c => serialize(c, settings.defaultFuelPrice))
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const [rows, settings] = await Promise.all([
    prisma.customer.findMany({
      select: {
        status: true, pendingGallons: true, currentBalance: true,
        priceType: true, fuelPricePerGallon: true, priceDiscount: true,
      },
    }),
    getSystemSettings(),
  ])
  const total    = rows.length
  const active   = rows.filter(r => r.status === CustomerStatus.ACTIVE).length
  const inactive = total - active

  const effectivePrices = rows.map(r => resolveCustomerPrice(
    {
      priceType:          r.priceType as "FIXED" | "DISCOUNT_PCT",
      fuelPricePerGallon: r.fuelPricePerGallon.toNumber(),
      priceDiscount:      r.priceDiscount.toNumber(),
    },
    settings.defaultFuelPrice,
  ))

  // pendingGallons counter — stored per customer
  const totalPendingGallons = rows.reduce((s, r) => s + r.pendingGallons.toNumber(), 0)

  // Use currentBalance (authoritative debt) instead of pendingGallons × price,
  // which diverges after partial payments.
  const totalPendingAmount = rows.reduce((s, r) => s + r.currentBalance.toNumber(), 0)

  const activeIdx = rows.map((r, i) => r.status === CustomerStatus.ACTIVE ? i : -1).filter(i => i >= 0)
  const avgPricePerGallon = activeIdx.length > 0
    ? activeIdx.reduce((s, i) => s + effectivePrices[i], 0) / activeIdx.length
    : 0

  return { total, active, inactive, totalPendingGallons, totalPendingAmount, avgPricePerGallon }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCustomer(data: CustomerFormData) {
  await prisma.customer.create({
    data: {
      name:               data.name.trim(),
      phone:              data.phone?.trim()   || null,
      email:              data.email?.trim()   || null,
      address:            data.address?.trim() || null,
      rnc:                data.rnc?.trim()     || null,
      creditLimit:        data.creditLimit        ?? 0,
      pendingGallons:     data.pendingGallons     ?? 0,
      priceType:          (data.priceType ?? "FIXED") as CustomerPriceType,
      fuelPricePerGallon: data.fuelPricePerGallon ?? 0,
      priceDiscount:      data.priceDiscount      ?? 0,
      notes:              data.notes?.trim()   || null,
    },
  })
  revalidatePath("/clientes")
  revalidatePath("/suministro")
}

export async function updateCustomer(id: string, data: CustomerFormData) {
  await prisma.customer.update({
    where: { id },
    data: {
      name:               data.name.trim(),
      phone:              data.phone?.trim()   || null,
      email:              data.email?.trim()   || null,
      address:            data.address?.trim() || null,
      rnc:                data.rnc?.trim()     || null,
      creditLimit:        data.creditLimit        ?? 0,
      pendingGallons:     data.pendingGallons     ?? 0,
      priceType:          (data.priceType ?? "FIXED") as CustomerPriceType,
      fuelPricePerGallon: data.fuelPricePerGallon ?? 0,
      priceDiscount:      data.priceDiscount      ?? 0,
      notes:              data.notes?.trim()   || null,
    },
  })
  revalidatePath("/clientes")
  revalidatePath("/suministro")
}

export async function deactivateCustomer(id: string) {
  await prisma.customer.update({
    where: { id },
    data: { status: CustomerStatus.INACTIVE },
  })
  revalidatePath("/clientes")
}

export async function activateCustomer(id: string) {
  await prisma.customer.update({
    where: { id },
    data: { status: CustomerStatus.ACTIVE },
  })
  revalidatePath("/clientes")
}
