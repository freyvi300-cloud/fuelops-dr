import { getTrucks, getTruckStats, getNextTruckCode } from "@/app/actions/trucks"
import { getCustomers } from "@/app/actions/customers"
import TrucksClient from "@/components/camiones/trucks-client"

export const dynamic = "force-dynamic"

export default async function CamionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [trucks, stats, customers, nextCode] = await Promise.all([
    getTrucks(q),
    getTruckStats(),
    getCustomers(),      // active + inactive customers for the form selector
    getNextTruckCode(),
  ])

  return (
    <TrucksClient
      trucks={trucks}
      stats={stats}
      customers={customers}
      nextCode={nextCode}
      initialSearch={q ?? ""}
    />
  )
}
