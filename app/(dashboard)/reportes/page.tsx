import { buildFullReport } from "@/lib/reporting"
import type { Period }     from "@/lib/reporting"
import ReportsClient        from "@/components/reportes/reports-client"

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

  // Single call — all computations run in parallel inside buildFullReport()
  const report = await buildFullReport(period)

  return <ReportsClient report={report} activePeriod={period} />
}
