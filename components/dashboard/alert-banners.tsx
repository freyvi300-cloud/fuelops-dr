import Link from "next/link"
import { AlertTriangle, Clock, Truck } from "lucide-react"
import type { AlertItem, AlertType } from "@/lib/data/types"

interface AlertBannersProps {
  alerts: AlertItem[]
}

const alertConfig: Record<AlertType, {
  Icon: React.ElementType
  iconColor: string
  iconBg: string
  border: string
  titleColor: string
  linkColor: string
}> = {
  inventory: {
    Icon: AlertTriangle,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50",
    border: "border-orange-100",
    titleColor: "text-orange-700",
    linkColor: "text-orange-600 hover:text-orange-700",
  },
  invoices: {
    Icon: Clock,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    border: "border-amber-100",
    titleColor: "text-amber-700",
    linkColor: "text-amber-600 hover:text-amber-700",
  },
  trucks: {
    Icon: Truck,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    border: "border-blue-100",
    titleColor: "text-blue-700",
    linkColor: "text-blue-600 hover:text-blue-700",
  },
}

export default function AlertBanners({ alerts }: AlertBannersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {alerts.map((alert) => {
        const cfg = alertConfig[alert.type]
        const { Icon } = cfg
        return (
          <div
            key={alert.title}
            className={`bg-white rounded-2xl border ${cfg.border} p-5 flex items-start gap-4`}
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${cfg.titleColor} leading-tight tracking-tight`}>
                {alert.title}
              </p>
              <p className="text-xs font-sans text-slate-500 mt-0.5 leading-snug">{alert.description}</p>
              <Link
                href={alert.link}
                className={`text-xs font-sans font-semibold mt-2 inline-block ${cfg.linkColor} transition-colors`}
              >
                {alert.linkLabel}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
