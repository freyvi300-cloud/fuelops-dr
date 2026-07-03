import { getFinancialDashboard } from "@/app/actions/finance"
import { getCustomers }          from "@/app/actions/customers"
import FinanceClient             from "@/components/finanzas/finance-client"

export const dynamic = "force-dynamic"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function firstDayOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default async function FinanzasPage() {
  const dateFrom = firstDayOfMonthISO()
  const dateTo   = todayISO()

  const [initialData, customers] = await Promise.all([
    getFinancialDashboard(dateFrom, dateTo),
    getCustomers(),
  ])

  return (
    <FinanceClient
      initialData={initialData}
      customers={customers.map(c => ({ id: c.id, name: c.name }))}
      defaultDateFrom={dateFrom}
      defaultDateTo={dateTo}
    />
  )
}
