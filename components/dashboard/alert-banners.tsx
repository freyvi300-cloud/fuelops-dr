import Link from "next/link"
import { AlertTriangle, Clock, Truck } from "lucide-react"

const alerts = [
  {
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50",
    border: "border-orange-100",
    title: "Inventario bajo",
    titleColor: "text-orange-700",
    description: "El diésel regular está por debajo del 30%",
    link: "/inventario",
    linkLabel: "Ver inventario →",
    linkColor: "text-orange-600 hover:text-orange-700",
  },
  {
    icon: Clock,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    border: "border-amber-100",
    title: "3 facturas vencidas",
    titleColor: "text-amber-700",
    description: "Por un total de RD$42,500.00",
    link: "/facturacion",
    linkLabel: "Ver facturas →",
    linkColor: "text-amber-600 hover:text-amber-700",
  },
  {
    icon: Truck,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    border: "border-blue-100",
    title: "2 camiones activos",
    titleColor: "text-blue-700",
    description: "En suministro en este momento",
    link: "/camiones",
    linkLabel: "Ver camiones →",
    linkColor: "text-blue-600 hover:text-blue-700",
  },
]

export default function AlertBanners() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {alerts.map((alert) => {
        const Icon = alert.icon
        return (
          <div
            key={alert.title}
            className={`bg-white rounded-2xl border ${alert.border} shadow-sm p-4 flex items-start gap-3`}
          >
            <div className={`w-9 h-9 ${alert.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${alert.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${alert.titleColor} leading-tight`}>{alert.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{alert.description}</p>
              <Link href={alert.link} className={`text-xs font-medium mt-1.5 inline-block ${alert.linkColor} transition-colors`}>
                {alert.linkLabel}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
