import Link from "next/link"
import { Building2 } from "lucide-react"
import type { PendingClient } from "@/lib/data/types"

interface PendingClientsProps {
  clients: PendingClient[]
}

export default function PendingClients({ clients }: PendingClientsProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">Clientes con pagos pendientes</h3>
        <Link href="/cobros" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Ver todas
        </Link>
      </div>

      <div className="space-y-3.5">
        {clients.map((c) => (
          <div key={c.nombre} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5 text-blue-600" style={{ width: "18px", height: "18px" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{c.nombre}</p>
              <p className="text-[11px] font-sans text-slate-400 mt-0.5">{c.dias} días vencido</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-red-600">{c.monto}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 text-center">
        <Link href="/clientes" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Ver todos los clientes →
        </Link>
      </div>
    </div>
  )
}
