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
  notes?: string | null
}

// Serializable version — Prisma Decimal converted to number for client components
export interface SerializedCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  rnc: string | null
  creditLimit: number
  currentBalance: number
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

function serialize(c: {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  rnc: string | null
  creditLimit: { toNumber: () => number }
  currentBalance: { toNumber: () => number }
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): SerializedCustomer {
  return {
    ...c,
    creditLimit: c.creditLimit.toNumber(),
    currentBalance: c.currentBalance.toNumber(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string): Promise<SerializedCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
  })
  return customers.map(serialize)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCustomer(data: CustomerFormData) {
  await prisma.customer.create({
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      rnc: data.rnc?.trim() || null,
      creditLimit: data.creditLimit ?? 0,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/clientes")
}

export async function updateCustomer(id: string, data: CustomerFormData) {
  await prisma.customer.update({
    where: { id },
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      rnc: data.rnc?.trim() || null,
      creditLimit: data.creditLimit ?? 0,
      notes: data.notes?.trim() || null,
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
