import { auth }                   from "@/lib/auth"
import { redirect }               from "next/navigation"
import { ShieldOff }              from "lucide-react"
import { getFinancialDashboard }  from "@/app/actions/finance"
import { getCustomers }           from "@/app/actions/customers"
import FinanceClient              from "@/components/finanzas/finance-client"

export const dynamic = "force-dynamic"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function firstDayOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default async function FinanzasPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = (session.user as { role?: string }).role

  if (role !== "ADMIN") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Acceso denegado
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Esta sección solo está disponible para administradores del sistema.
          </p>
        </div>
      </div>
    )
  }

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
