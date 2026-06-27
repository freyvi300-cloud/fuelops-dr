import { getInventoryMovements, getInventoryStats } from "@/app/actions/inventory"
import InventoryClient from "@/components/inventario/inventory-client"

export const dynamic = "force-dynamic"

export default async function InventarioPage() {
  const [movements, stats] = await Promise.all([
    getInventoryMovements(),
    getInventoryStats(),
  ])

  return <InventoryClient movements={movements} stats={stats} />
}
