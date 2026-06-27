// Dashboard data layer.
// Each function is async and returns typed data.
// Replace the return values with Prisma queries when connecting Supabase.
//
// Example replacement:
//   import { prisma } from "@/lib/prisma"
//   export async function getRecentInvoices() {
//     return prisma.sale.findMany({ take: 5, orderBy: { createdAt: "desc" }, ... })
//   }

import type {
  Kpi,
  SalePoint,
  InventoryPoint,
  Invoice,
  PendingClient,
  MeterPhoto,
  AlertItem,
} from "./types"

export async function getDashboardKpis(): Promise<Kpi[]> {
  return [
    {
      title: "Ventas de hoy",
      value: "RD$0.00",
      icon: "dollar",
      emptyMessage: "No hay ventas registradas hoy.",
    },
    {
      title: "Combustible disponible",
      value: "0 gal",
      icon: "droplets",
      progress: 0,
      progressLabel: "Capacidad total: — gal",
      emptyMessage: "Aún no se ha registrado inventario.",
    },
    {
      title: "Servicios realizados",
      value: "0",
      icon: "truck",
      emptyMessage: "Sin servicios registrados hoy.",
    },
    {
      title: "Cuentas por cobrar",
      value: "RD$0.00",
      icon: "wallet",
      emptyMessage: "No hay cuentas pendientes.",
    },
  ]
}

export async function getSalesChartData(): Promise<SalePoint[]> {
  // TODO: return prisma.sale.groupBy({ by: ["saleDate"], ... })
  return []
}

export async function getInventoryChartData(): Promise<InventoryPoint[]> {
  // TODO: return prisma.dailyReport.findMany({ orderBy: { reportDate: "asc" }, take: 7, ... })
  return []
}

export async function getRecentInvoices(): Promise<Invoice[]> {
  // TODO: return prisma.sale.findMany({ take: 5, orderBy: { createdAt: "desc" }, ... })
  return []
}

export async function getPendingClients(): Promise<PendingClient[]> {
  // TODO: return prisma.customer.findMany({ where: { currentBalance: { gt: 0 } }, ... })
  return []
}

export async function getRecentPhotos(): Promise<MeterPhoto[]> {
  // TODO: return prisma.sale.findMany({ where: { meterPhotoUrl: { not: null } }, take: 8, ... })
  return []
}

export async function getAlerts(): Promise<AlertItem[]> {
  // TODO: compute alerts from real inventory and overdue sales
  return []
}
