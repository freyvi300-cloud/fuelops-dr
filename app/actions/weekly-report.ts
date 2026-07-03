"use server"

import { prisma }            from "@/lib/prisma"
import { getSystemSettings } from "@/lib/system-settings"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySupplyRow {
  id:             string
  date:           string
  truckCode:      string | null
  truckName:      string | null
  gallons:        number
  pricePerGallon: number
  total:          number
  invoiceNumber:  string | null
  paymentType:    "CASH" | "CREDIT"
}

export interface WeeklyCustomerReport {
  customer: {
    id:             string
    name:           string
    phone:          string | null
    address:        string | null
    rnc:            string | null
    currentBalance: number
  }
  supplies: WeeklySupplyRow[]
  totals: {
    totalGallons: number
    totalBilled:  number
    balanceDue:   number
  }
}

export interface WeeklyReportResult {
  dateFrom:        string
  dateTo:          string
  periodLabel:     string
  weekNumber:      number | null
  businessName:    string
  businessPhone:   string | null
  businessAddress: string | null
  reports:         WeeklyCustomerReport[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
}

function fmtLocal(d: Date) {
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getWeeklyReportData(
  dateFromISO: string,
  dateToISO:   string,
  customerId:  string | "all",
): Promise<WeeklyReportResult> {
  const dateFrom = new Date(dateFromISO + "T00:00:00.000Z")
  const dateTo   = new Date(dateToISO   + "T23:59:59.999Z")

  // Show week number only when range is exactly 7 days (Mon–Sun)
  const diffDays = Math.round((dateTo.getTime() - dateFrom.getTime()) / 86_400_000)
  const weekNumber = diffDays === 6 ? isoWeekNumber(dateFrom) : null

  const periodLabel = `${fmtLocal(dateFrom)} al ${fmtLocal(dateTo)}`

  const settings = await getSystemSettings()

  const customerWhere = customerId === "all"
    ? { status: "ACTIVE" as const }
    : { id: customerId, status: "ACTIVE" as const }

  const customers = await prisma.customer.findMany({
    where:  customerWhere,
    select: {
      id: true, name: true, phone: true, address: true, rnc: true, currentBalance: true,
      supplies: {
        where: { suppliedAt: { gte: dateFrom, lte: dateTo } },
        include: {
          truck:   { select: { code: true, name: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { suppliedAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })

  const reports: WeeklyCustomerReport[] = customers
    .filter(c => c.supplies.length > 0)
    .map(c => {
      const supplies: WeeklySupplyRow[] = c.supplies.map(s => ({
        id:             s.id,
        date:           s.suppliedAt.toISOString(),
        truckCode:      s.truck?.code  ?? null,
        truckName:      s.truck?.name  ?? null,
        gallons:        Number(s.gallons),
        pricePerGallon: Number(s.pricePerGallon),
        total:          Number(s.total),
        invoiceNumber:  s.invoice?.invoiceNumber ?? null,
        paymentType:    s.paymentType as "CASH" | "CREDIT",
      }))

      const totalGallons = supplies.reduce((a, s) => a + s.gallons, 0)
      const totalBilled  = supplies.reduce((a, s) => a + s.total,   0)

      return {
        customer: {
          id:             c.id,
          name:           c.name,
          phone:          c.phone,
          address:        c.address,
          rnc:            c.rnc,
          currentBalance: Number(c.currentBalance),
        },
        supplies,
        totals: { totalGallons, totalBilled, balanceDue: Number(c.currentBalance) },
      }
    })

  return {
    dateFrom:        dateFrom.toISOString(),
    dateTo:          dateTo.toISOString(),
    periodLabel,
    weekNumber,
    businessName:    settings.businessName,
    businessPhone:   settings.phone,
    businessAddress: settings.address,
    reports,
  }
}
