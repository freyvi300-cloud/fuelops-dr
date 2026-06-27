import { Truck } from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Trucks/Equipment module
// - Truck model: plate, description, customerId, fuelType, photoUrl, isActive
// - Link trucks to customers (Customer → Trucks 1:N)
// - Truck selector in /suministro will pull from this module
// - Support quick-add inline from /suministro form

export default function CamionesPage() {
  return (
    <PageShell
      title="Camiones / Equipos"
      description="Gestiona los vehículos y equipos que reciben combustible."
      actionLabel="Registrar camión"
      icon={Truck}
      emptyIcon={Truck}
      emptyTitle="No hay camiones registrados"
      emptyDescription="Registra el primer vehículo para asociarlo a un cliente y comenzar a registrar suministros por placa."
    />
  )
}
