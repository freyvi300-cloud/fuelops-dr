import { getCustomers } from "@/app/actions/customers"
import { getTrucks }    from "@/app/actions/trucks"
import { getRecentSupplies } from "@/app/actions/supplies"
import SupplyForm from "@/components/suministro/supply-form"

export const dynamic = "force-dynamic"

export default async function SuministroPage() {
  const [customers, trucks, recentSupplies] = await Promise.all([
    getCustomers(),
    getTrucks(),
    getRecentSupplies(6),
  ])

  return (
    <SupplyForm
      customers={customers}
      trucks={trucks}
      recentSupplies={recentSupplies}
    />
  )
}
