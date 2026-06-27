import { getCustomers } from "@/app/actions/customers"
import SupplyForm from "@/components/suministro/supply-form"

export const dynamic = "force-dynamic"

export default async function SuministroPage() {
  const customers = await getCustomers()

  return <SupplyForm customers={customers} />
}
