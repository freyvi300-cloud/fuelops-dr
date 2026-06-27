import { getCustomers, getCustomerStats } from "@/app/actions/customers"
import CustomersClient from "@/components/clientes/customers-client"

export const dynamic = "force-dynamic"

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [customers, stats] = await Promise.all([
    getCustomers(q),
    getCustomerStats(),
  ])

  return <CustomersClient customers={customers} stats={stats} initialSearch={q ?? ""} />
}
