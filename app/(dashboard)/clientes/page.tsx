import { getCustomers, getCustomerStats } from "@/app/actions/customers"
import { getSystemSettings }              from "@/lib/system-settings"
import CustomersClient                    from "@/components/clientes/customers-client"

export const dynamic = "force-dynamic"

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [customers, stats, settings] = await Promise.all([
    getCustomers(q),
    getCustomerStats(),
    getSystemSettings(),
  ])

  return (
    <CustomersClient
      customers={customers}
      stats={stats}
      initialSearch={q ?? ""}
      baseFuelPrice={settings.defaultFuelPrice}
    />
  )
}
