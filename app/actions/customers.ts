"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { CustomerStatus } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomerFormData {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  rnc?: string | null
  creditLimit?: number
  pendingGallons?: number
  fuelPricePerGallon?: number
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
  fuelPricePerGallon: number
  /** Calculated: pendingGallons × fuelPricePerGallon — never stored */
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
  status: string; notes: string | null; createdAt: Date; updatedAt: Date
}): SerializedCustomer {
  const gallons = c.pendingGallons.toNumber()
  const price   = c.fuelPricePerGallon.toNumber()
  return {
    id:                 c.id,
    name:               c.name,
    phone:              c.phone,
    email:              c.email,
    address:            c.address,
    rnc:                c.rnc,
    creditLimit:        c.creditLimit.toNumber(),
    currentBalance:     c.currentBalance.toNumber(),
    pendingGallons:     gallons,
    fuelPricePerGallon: price,
    totalPending:       gallons * price,
    status:             c.status,
    notes:              c.notes,
    createdAt:          c.createdAt.toISOString(),
    updatedAt:          c.updatedAt.toISOString(),
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string): Promise<SerializedCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: search ? {
      OR: [
        { name:  { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { rnc:   { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return customers.map(serialize)
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const rows = await prisma.customer.findMany({
    select: { status: true, pendingGallons: true, fuelPricePerGallon: true },
  })
  const total    = rows.length
  const active   = rows.filter(r => r.status === CustomerStatus.ACTIVE).length
  const inactive = total - active

  const totalPendingGallons = rows.reduce((s, r) => s + r.pendingGallons.toNumber(), 0)
  const totalPendingAmount  = rows.reduce(
    (s, r) => s + r.pendingGallons.toNumber() * r.fuelPricePerGallon.toNumber(), 0
  )
  const activeRows = rows.filter(r => r.status === CustomerStatus.ACTIVE)
  const avgPricePerGallon = activeRows.length > 0
    ? activeRows.reduce((s, r) => s + r.fuelPricePerGallon.toNumber(), 0) / activeRows.length
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
      fuelPricePerGallon: data.fuelPricePerGallon ?? 0,
      notes:              data.notes?.trim()   || null,
    },
  })
  revalidatePath("/clientes")
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
      fuelPricePerGallon: data.fuelPricePerGallon ?? 0,
      notes:              data.notes?.trim()   || null,
    },
  })
  revalidatePath("/clientes")
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
