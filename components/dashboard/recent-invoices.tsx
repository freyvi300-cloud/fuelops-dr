import Link from "next/link"
import { cn } from "@/lib/utils"

const invoices = [
  { folio: "F-000145", cliente: "Transporte Del Norte", fecha: "17/06/2025", total: "RD$25,000.00", estado: "Pagada" },
  { folio: "F-000144", cliente: "Constructora R & H", fecha: "17/06/2025", total: "RD$18,750.00", estado: "Pagada" },
  { folio: "F-000143", cliente: "Agroservicios Ruiz", fecha: "17/06/2025", total: "RD$32,500.00", estado: "Suministro" },
  { folio: "F-000142", cliente: "Transporte Madera SRL", fecha: "16/06/2025", total: "RD$21,000.00", estado: "Pagada" },
  { folio: "F-000141", cliente: "Inversiones Beta", fecha: "16/06/2025", total: "RD$15,000.00", estado: "Pagada" },
]

const estadoStyles: Record<string, string> = {
  Pagada: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Suministro: "bg-amber-50 text-amber-700 border-amber-100",
  Pendiente: "bg-red-50 text-red-700 border-red-100",
}

export default function RecentInvoices() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Últimas facturas</h3>
        <Link href="/facturacion" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todas
        </Link>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-slate-400 font-medium pb-2 px-1">Folio</th>
              <th className="text-left text-slate-400 font-medium pb-2 px-1">Cliente</th>
              <th className="text-left text-slate-400 font-medium pb-2 px-1 hidden sm:table-cell">Fecha</th>
              <th className="text-right text-slate-400 font-medium pb-2 px-1">Total</th>
              <th className="text-center text-slate-400 font-medium pb-2 px-1">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map((inv) => (
              <tr key={inv.folio} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-1 font-medium text-slate-700">{inv.folio}</td>
                <td className="py-2.5 px-1 text-slate-600 max-w-[120px] truncate">{inv.cliente}</td>
                <td className="py-2.5 px-1 text-slate-400 hidden sm:table-cell">{inv.fecha}</td>
                <td className="py-2.5 px-1 text-right font-semibold text-slate-800">{inv.total}</td>
                <td className="py-2.5 px-1 text-center">
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border",
                    estadoStyles[inv.estado] ?? "bg-slate-100 text-slate-600"
                  )}>
                    {inv.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <Link href="/facturacion" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todas las facturas →
        </Link>
      </div>
    </div>
  )
}
