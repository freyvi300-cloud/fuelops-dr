import Link from "next/link"
import { Building2 } from "lucide-react"

const pendientes = [
  { nombre: "Constructora R & H", monto: "RD$25,000.00", dias: 15 },
  { nombre: "Agroservicios Ruiz", monto: "RD$18,500.00", dias: 8 },
  { nombre: "Transporte Madera SRL", monto: "RD$15,000.00", dias: 5 },
  { nombre: "Inversiones Beta", monto: "RD$12,500.00", dias: 3 },
  { nombre: "Servicios Generales J&J", monto: "RD$11,000.00", dias: 2 },
]

export default function PendingClients() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Clientes con pagos pendientes</h3>
        <Link href="/cobros" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todas
        </Link>
      </div>

      <div className="space-y-3">
        {pendientes.map((c) => (
          <div key={c.nombre} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{c.nombre}</p>
              <p className="text-[11px] text-slate-400">{c.dias} días vencido</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-red-600">{c.monto}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <Link href="/clientes" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todos los clientes →
        </Link>
      </div>
    </div>
  )
}
