// Shared TypeScript interfaces for all dashboard data.
// These types mirror the Prisma schema — when connecting Supabase,
// the mock functions in dashboard.ts are replaced with real Prisma queries.

export type KpiIcon = "dollar" | "droplets" | "truck" | "wallet"

export interface Kpi {
  title: string
  value: string
  icon: KpiIcon
  trend?: string
  trendUp?: boolean
  progress?: number
  progressLabel?: string
  emptyMessage: string
}

export interface SalePoint {
  date: string
  ventas: number
}

export interface InventoryPoint {
  date: string
  galones: number
}

export type InvoiceStatus = "Pagada" | "Suministro" | "Pendiente"

export interface Invoice {
  folio: string
  cliente: string
  fecha: string
  total: string
  estado: InvoiceStatus
}

export interface PendingClient {
  nombre: string
  monto: string
  dias: number
}

export interface MeterPhoto {
  reading: string
  time: string
}

export type AlertType = "inventory" | "invoices" | "trucks"

export interface AlertItem {
  type: AlertType
  title: string
  description: string
  link: string
  linkLabel: string
}
