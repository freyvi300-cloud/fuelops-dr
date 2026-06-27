import {
  BarChart3, TrendingUp, FileText,
  Droplets, Users, DollarSign,
} from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Reports module
// - Daily report: opening stock, sales, deliveries, closing stock, discrepancy
// - Monthly P&L: revenue (cash+credit), fuel cost, gross margin
// - Debtor aging: 0-30 / 31-60 / 61-90 / 90+ buckets per customer
// - PDF export via react-pdf
// - Excel export via xlsx library

const REPORT_TYPES = [
  {
    icon: TrendingUp,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Reporte de ventas",
    description: "Ventas diarias, semanales y mensuales. Desglose por cliente y tipo de pago.",
    tag: "Próximamente",
  },
  {
    icon: Droplets,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    title: "Reporte de inventario",
    description: "Movimientos del tanque: entradas, suministros, cierres diarios y discrepancias.",
    tag: "Próximamente",
  },
  {
    icon: DollarSign,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Cuentas por cobrar",
    description: "Envejecimiento de deudas por cliente: 0-30, 31-60, 61-90, 90+ días.",
    tag: "Próximamente",
  },
  {
    icon: Users,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "Reporte de empleados",
    description: "Actividad por empleado: suministros registrados, cobros realizados.",
    tag: "Próximamente",
  },
  {
    icon: FileText,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Reporte de cierre diario",
    description: "Apertura, ventas, inventario y cierre del día. Aprobado por el administrador.",
    tag: "Próximamente",
  },
  {
    icon: BarChart3,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    title: "Reporte personalizado",
    description: "Genera reportes filtrados por fecha, cliente, camión o tipo de pago.",
    tag: "Fase 4",
  },
]

export default function ReportesPage() {
  return (
    <PageShell
      title="Reportes"
      description="Genera reportes de ventas, inventario y cobranzas en PDF o Excel."
      actionLabel="Generar reporte"
      icon={BarChart3}
      emptyIcon={BarChart3}
      emptyTitle=""
      emptyDescription=""
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_TYPES.map((r) => {
          const Icon = r.icon
          return (
            <div
              key={r.title}
              className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 opacity-70"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.iconBg}`}>
                  <Icon className={`w-5 h-5 ${r.iconColor}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
                  {r.tag}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm tracking-tight">{r.title}</p>
                <p className="text-xs font-sans text-slate-400 mt-1 leading-relaxed">{r.description}</p>
              </div>
              <button
                disabled
                className="mt-auto w-full py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                Generar PDF
              </button>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}
