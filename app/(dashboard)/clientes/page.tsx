import { getCustomers } from "@/app/actions/customers"
import CustomersClient from "@/components/clientes/customers-client"

export const dynamic = "force-dynamic"

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const customers = await getCustomers(q)

  return <CustomersClient customers={customers} initialSearch={q ?? ""} />
}
