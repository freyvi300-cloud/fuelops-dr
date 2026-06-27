// Dashboard data layer.
// Each function is async and returns typed data.
// Replace the mock return values with Prisma queries when connecting Supabase.
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
      value: "RD$350,250.00",
      icon: "dollar",
      trend: "+18.4% vs ayer",
      trendUp: true,
    },
    {
      title: "Combustible disponible",
      value: "14,250 gal",
      icon: "droplets",
      progress: 71.25,
      progressLabel: "Capacidad total: 20,000 gal",
    },
    {
      title: "Servicios realizados",
      value: "27",
      icon: "truck",
      trend: "+8 vs ayer",
      trendUp: true,
    },
    {
      title: "Cuentas por cobrar",
      value: "RD$82,000.00",
      icon: "wallet",
      trend: "+6.7% vs semana pasada",
      trendUp: true,
    },
  ]
}

export async function getSalesChartData(): Promise<SalePoint[]> {
  return [
    { date: "11 Jun", ventas: 120000 },
    { date: "12 Jun", ventas: 280000 },
    { date: "13 Jun", ventas: 180000 },
    { date: "14 Jun", ventas: 220000 },
    { date: "15 Jun", ventas: 200000 },
    { date: "16 Jun", ventas: 240000 },
    { date: "17 Jun", ventas: 350250 },
  ]
}

export async function getInventoryChartData(): Promise<InventoryPoint[]> {
  return [
    { date: "11 Jun", galones: 15000 },
    { date: "12 Jun", galones: 16000 },
    { date: "13 Jun", galones: 15500 },
    { date: "14 Jun", galones: 15800 },
    { date: "15 Jun", galones: 15200 },
    { date: "16 Jun", galones: 14800 },
    { date: "17 Jun", galones: 14250 },
  ]
}

export async function getRecentInvoices(): Promise<Invoice[]> {
  return [
    { folio: "F-000145", cliente: "Transporte Del Norte",   fecha: "17/06/2025", total: "RD$25,000.00", estado: "Pagada" },
    { folio: "F-000144", cliente: "Constructora R & H",     fecha: "17/06/2025", total: "RD$18,750.00", estado: "Pagada" },
    { folio: "F-000143", cliente: "Agroservicios Ruiz",     fecha: "17/06/2025", total: "RD$32,500.00", estado: "Suministro" },
    { folio: "F-000142", cliente: "Transporte Madera SRL",  fecha: "16/06/2025", total: "RD$21,000.00", estado: "Pagada" },
    { folio: "F-000141", cliente: "Inversiones Beta",       fecha: "16/06/2025", total: "RD$15,000.00", estado: "Pagada" },
  ]
}

export async function getPendingClients(): Promise<PendingClient[]> {
  return [
    { nombre: "Constructora R & H",    monto: "RD$25,000.00", dias: 15 },
    { nombre: "Agroservicios Ruiz",     monto: "RD$18,500.00", dias: 8 },
    { nombre: "Transporte Madera SRL",  monto: "RD$15,000.00", dias: 5 },
    { nombre: "Inversiones Beta",       monto: "RD$12,500.00", dias: 3 },
    { nombre: "Servicios Generales J&J",monto: "RD$11,000.00", dias: 2 },
  ]
}

export async function getRecentPhotos(): Promise<MeterPhoto[]> {
  return [
    { reading: "01233", time: "8:45 AM" },
    { reading: "00429", time: "8:32 AM" },
    { reading: "00895", time: "8:15 AM" },
    { reading: "00855", time: "7:50 AM" },
    { reading: "01028", time: "7:25 AM" },
    { reading: "00338", time: "7:10 AM" },
    { reading: "01851", time: "6:55 AM" },
    { reading: "00938", time: "6:40 AM" },
  ]
}

export async function getAlerts(): Promise<AlertItem[]> {
  return [
    {
      type: "inventory",
      title: "Inventario bajo",
      description: "El diésel regular está por debajo del 30%",
      link: "/inventario",
      linkLabel: "Ver inventario →",
    },
    {
      type: "invoices",
      title: "3 facturas vencidas",
      description: "Por un total de RD$42,500.00",
      link: "/facturacion",
      linkLabel: "Ver facturas →",
    },
    {
      type: "trucks",
      title: "2 camiones activos",
      description: "En suministro en este momento",
      link: "/camiones",
      linkLabel: "Ver camiones →",
    },
  ]
}
