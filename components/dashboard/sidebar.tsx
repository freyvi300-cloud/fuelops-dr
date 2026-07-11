"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings, MessageCircle,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/theme/theme-toggle"

const navItems = [
  { href: "/",              label: "Dashboard",            icon: LayoutDashboard, primary: false },
  { href: "/suministro",    label: "Registrar suministro", icon: Fuel,            primary: true  },
  { href: "/clientes",      label: "Clientes",             icon: Users,           primary: false },
  { href: "/camiones",      label: "Camiones / Equipos",   icon: Truck,           primary: false },
  { href: "/inventario",    label: "Inventario",           icon: Droplets,        primary: false },
  { href: "/facturas",      label: "Facturas",             icon: Receipt,         primary: false },
  { href: "/cobros",        label: "Cobros",               icon: CircleDollarSign,primary: false },
  { href: "/reportes",      label: "Reportes",             icon: BarChart3,       primary: false },
  { href: "/finanzas",      label: "Finanzas",             icon: TrendingUp,      primary: false },
  { href: "/whatsapp",      label: "WhatsApp",             icon: MessageCircle,   primary: false },
  { href: "/empleados",     label: "Empleados",            icon: UserCog,         primary: false },
  { href: "/configuracion", label: "Configuración",        icon: Settings,        primary: false },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className={cn(
      // Fixed w-56 — no hover-expand, no width transition, no layout shift
      "hidden md:flex flex-col sticky top-0 h-screen shrink-0 w-56 overflow-hidden",
      "bg-[#1a3fa0] dark:bg-[#0f2660]",
      "shadow-[2px_0_12px_rgba(0,0,0,0.10)] dark:shadow-[2px_0_20px_rgba(0,0,0,0.35)]",
    )}>

      {/* Logo row — always visible, no hide/show on hover */}
      <div className="flex items-center gap-3 px-3 py-[1.1rem] border-b border-white/10">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-5 h-5 text-[#1a3fa0]" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight">LBP</p>
          <p className="text-blue-200 text-[11px] leading-tight mt-0.5 truncate">
            Inversiones y Servicios S.R.L.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ href, label, icon: Icon, primary }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`)

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group/item flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold",
                  // Color + translate-x transition — no width change
                  "transition-all duration-200",
                  "hover:translate-x-0.5",
                  active
                    ? "bg-white text-[#1a3fa0] shadow-sm"
                    : "bg-white/20 text-white hover:bg-white/30",
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200",
                  "group-hover/item:scale-110",
                  active ? "text-[#1a3fa0]" : "text-white",
                )} />
                <span className="truncate">{label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group/item flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-200",
                "hover:translate-x-0.5",
                active
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-blue-100/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cn(
                "w-5 h-5 shrink-0 transition-transform duration-200",
                "group-hover/item:scale-110",
                active ? "text-white" : "text-blue-200",
              )} />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer: theme toggle + company card */}
      <div className="mx-2 mb-4 space-y-2">
        <div className="px-1">
          <ThemeToggle compact />
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">LBP Inversiones</p>
            <p className="text-blue-200 text-[11px] leading-tight">y Servicios S.R.L.</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
