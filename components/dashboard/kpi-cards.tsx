import { DollarSign, Droplets, Truck, Wallet, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const kpis = [
  {
    title: "Ventas de hoy",
    value: "RD$350,250.00",
    trend: "+18.4% vs ayer",
    trendUp: true,
    icon: DollarSign,
  },
  {
    title: "Combustible disponible",
    value: "14,250 gal",
    sub: "Capacidad total: 20,000 gal",
    progress: 71.25,
    icon: Droplets,
  },
  {
    title: "Servicios realizados",
    value: "27",
    trend: "+8 vs ayer",
    trendUp: true,
    icon: Truck,
  },
  {
    title: "Cuentas por cobrar",
    value: "RD$82,000.00",
    trend: "+6.7% vs semana pasada",
    trendUp: true,
    icon: Wallet,
  },
]

export default function KpiCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.title}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4"
          >
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium leading-tight">{kpi.title}</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5 leading-tight">{kpi.value}</p>

              {kpi.progress !== undefined && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${kpi.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{kpi.sub}</p>
                </div>
              )}

              {kpi.trend && (
                <div className={cn(
                  "flex items-center gap-1 mt-1",
                  kpi.trendUp ? "text-emerald-600" : "text-red-500"
                )}>
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-medium">{kpi.trend}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
