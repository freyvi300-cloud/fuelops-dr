import { getCustomers }       from "@/app/actions/customers"
import { getTrucks }          from "@/app/actions/trucks"
import { getRecentSupplies }  from "@/app/actions/supplies"
import { getSystemSettings }  from "@/lib/system-settings"
import SupplyForm             from "@/components/suministro/supply-form"

export const dynamic = "force-dynamic"

export default async function SuministroPage() {
  const [customers, trucks, recentSupplies, settings] = await Promise.all([
    getCustomers(),
    getTrucks(),
    getRecentSupplies(6),
    getSystemSettings(),
  ])

  return (
    <SupplyForm
      customers={customers}
      trucks={trucks}
      recentSupplies={recentSupplies}
      ocrEnabled={settings.ocrEnabled}
      ocrMinConfidence={settings.ocrMinConfidence}
    />
  )
}
