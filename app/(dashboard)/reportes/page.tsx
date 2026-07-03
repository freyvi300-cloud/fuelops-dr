import { buildFullReport } from "@/lib/reporting"
import type { Period }     from "@/lib/reporting"
import ReportsClient        from "@/components/reportes/reports-client"
import { prisma }           from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VALID_PERIODS: Period[] = ["today", "week", "month", "year"]

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: raw } = await searchParams
  const period: Period = VALID_PERIODS.includes(raw as Period)
    ? (raw as Period)
    : "month"

  const [report, customers] = await Promise.all([
    buildFullReport(period),
    prisma.customer.findMany({
      where:   { status: "ACTIVE" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return <ReportsClient report={report} activePeriod={period} customers={customers} />
}
