import { buildFullReport, buildReportByRange } from "@/lib/reporting"
import type { Period }     from "@/lib/reporting"
import ReportsClient        from "@/components/reportes/reports-client"
import { prisma }           from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VALID_PERIODS: Period[] = ["today", "week", "month", "year"]

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; customerId?: string }>
}) {
  const { period: raw, from, to, customerId } = await searchParams

  const period: Period = VALID_PERIODS.includes(raw as Period)
    ? (raw as Period)
    : "month"

  const [report, customers] = await Promise.all([
    (from && to) ? buildReportByRange(from, to) : buildFullReport(period),
    prisma.customer.findMany({
      where:   { status: "ACTIVE" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <ReportsClient
      report={report}
      activePeriod={period}
      customers={customers}
      activeDateFrom={from}
      activeDateTo={to}
      activeCustomerId={customerId}
    />
  )
}
