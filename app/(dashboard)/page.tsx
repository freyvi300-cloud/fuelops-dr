import { buildDashboardData } from "@/lib/reporting"
import ExecutiveDashboard     from "@/components/dashboard/executive-dashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  // Single call — all 11 queries run in parallel inside buildDashboardData()
  const data = await buildDashboardData()
  return <ExecutiveDashboard data={data} />
}
