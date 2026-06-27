import { Droplets, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Inventory module
// - FuelDelivery model: supplierId, litersReceived, costPerLiter, invoiceNumber, date
// - DailyReport model: openingStock, closingStock, expectedClosing, discrepancy
// - Track tank level via opening/closing gauge readings
// - Alert when stock < configurable threshold (e.g. 30%)
// - Inventory decrements automatically when a supply (suministro) is confirmed

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 font-display tracking-tight mt-0.5">{value}</p>
        <p className="text-[11px] font-sans text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

export default function InventarioPage() {
  return (
    <PageShell
      title="Inventario"
      description="Control del combustible disponible y movimientos del tanque principal."
      actionLabel="Registrar entrada de combustible"
      icon={Droplets}
      emptyIcon={Droplets}
      emptyTitle="Sin datos de inventario"
      emptyDescription="Registra la primera entrada de combustible para comenzar a controlar el inventario de tu tanque."
    >
      {/* Inventory stat cards — show zeros until real data exists */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            icon={Droplets}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="Combustible disponible"
            value="0.00 gal"
            sub="Nivel actual del tanque"
          />
          <StatCard
            icon={TrendingDown}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            label="Despachado hoy"
            value="0.00 gal"
            sub="Total suministrado hoy"
          />
          <StatCard
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Entradas esta semana"
            value="0.00 gal"
            sub="Combustible recibido"
          />
          <StatCard
            icon={AlertTriangle}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            label="Nivel del tanque"
            value="—"
            sub="Sin datos registrados"
          />
        </div>

        {/* Empty state */}
        <div
          className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 gap-3"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
            <Droplets className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 text-sm">No hay movimientos de inventario</p>
          <p className="text-xs font-sans text-slate-400 text-center max-w-sm leading-relaxed">
            Los movimientos aparecerán aquí cuando registres entradas de combustible
            o confirmes suministros a clientes.
          </p>
        </div>
      </div>
    </PageShell>
  )
}
