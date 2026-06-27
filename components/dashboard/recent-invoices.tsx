import Link from "next/link"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Invoice } from "@/lib/data/types"

const estadoStyles: Record<string, string> = {
  Pagada:     "bg-emerald-50 text-emerald-700 border border-emerald-100",
  Suministro: "bg-amber-50 text-amber-700 border border-amber-100",
  Pendiente:  "bg-red-50 text-red-700 border border-red-100",
}

interface RecentInvoicesProps {
  invoices: Invoice[]
}

export default function RecentInvoices({ invoices }: RecentInvoicesProps) {
  const isEmpty = invoices.length === 0

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">Últimas facturas</h3>
        {!isEmpty && (
          <Link href="/facturacion" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
            Ver todas
          </Link>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-sans text-slate-400 text-center leading-snug">
            No hay facturas registradas.
          </p>
          <Link
            href="/facturacion"
            className="text-xs font-sans text-blue-600 hover:text-blue-700 font-semibold transition-colors mt-1"
          >
            Registrar primera venta →
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-slate-400 font-medium pb-2.5 px-1 tracking-wide uppercase text-[10px]">Folio</th>
                  <th className="text-left text-slate-400 font-medium pb-2.5 px-1 tracking-wide uppercase text-[10px]">Cliente</th>
                  <th className="text-left text-slate-400 font-medium pb-2.5 px-1 tracking-wide uppercase text-[10px] hidden sm:table-cell">Fecha</th>
                  <th className="text-right text-slate-400 font-medium pb-2.5 px-1 tracking-wide uppercase text-[10px]">Total</th>
                  <th className="text-center text-slate-400 font-medium pb-2.5 px-1 tracking-wide uppercase text-[10px]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <tr key={inv.folio} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-1 font-semibold text-slate-700">{inv.folio}</td>
                    <td className="py-3 px-1 text-slate-600 max-w-[130px] truncate">{inv.cliente}</td>
                    <td className="py-3 px-1 text-slate-400 hidden sm:table-cell">{inv.fecha}</td>
                    <td className="py-3 px-1 text-right font-semibold text-slate-800">{inv.total}</td>
                    <td className="py-3 px-1 text-center">
                      <span className={cn(
                        "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium",
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
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <Link href="/facturacion" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Ver todas las facturas →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
