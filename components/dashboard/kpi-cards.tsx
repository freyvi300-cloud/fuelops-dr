import { DollarSign, Droplets, Truck, Wallet } from "lucide-react"
import type { Kpi, KpiIcon } from "@/lib/data/types"

const iconMap: Record<KpiIcon, React.ElementType> = {
  dollar: DollarSign,
  droplets: Droplets,
  truck: Truck,
  wallet: Wallet,
}

interface KpiCardsProps {
  kpis: Kpi[]
}

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.icon]
        const isEmpty = kpi.progress !== undefined
          ? kpi.progress === 0
          : kpi.value === "RD$0.00" || kpi.value === "0 gal" || kpi.value === "0"

        return (
          <div
            key={kpi.title}
            className="bg-white rounded-2xl border border-slate-100 p-6 flex items-start gap-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isEmpty ? "bg-slate-100" : "bg-blue-600"}`}>
              <Icon className={`w-6 h-6 ${isEmpty ? "text-slate-400" : "text-white"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium leading-tight tracking-wide uppercase">
                {kpi.title}
              </p>
              <p className={`text-2xl font-bold mt-1 leading-tight font-display tracking-tight ${isEmpty ? "text-slate-300" : "text-slate-900"}`}>
                {kpi.value}
              </p>

              {kpi.progress !== undefined && (
                <div className="mt-2.5">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${kpi.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] font-sans text-slate-400 mt-1.5 leading-snug">
                {kpi.emptyMessage}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
