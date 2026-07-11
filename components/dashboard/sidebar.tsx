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
      // Fixed overlay — expands on hover without shifting the flex layout.
      // The layout holds a permanent w-16 spacer div instead.
      "group hidden md:flex flex-col fixed left-0 top-0 z-40 h-screen overflow-hidden",
      "w-16 hover:w-56 transition-[width] duration-300 ease-in-out",
      "bg-[#1a3fa0] dark:bg-[#0f2660]",
      "shadow-[2px_0_12px_rgba(0,0,0,0.10)] dark:shadow-[2px_0_20px_rgba(0,0,0,0.35)]",
    )}>

      {/* Logo row — icon always visible, text fades in when expanded */}
      <div className="flex items-center gap-3 px-3 py-[1.1rem] border-b border-white/10 min-w-[14rem]">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-5 h-5 text-[#1a3fa0]" />
        </div>
        <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
          <p className="text-white font-bold text-sm leading-tight">LBP</p>
          <p className="text-blue-200 text-[11px] leading-tight mt-0.5">
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
                  "flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap",
                  "transition-colors duration-200",
                  active
                    ? "bg-white text-[#1a3fa0] shadow-sm"
                    : "bg-white/20 text-white hover:bg-white/30",
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 shrink-0",
                  active ? "text-[#1a3fa0]" : "text-white",
                )} />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 truncate">
                  {label}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap",
                "transition-colors duration-200",
                active
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-blue-100/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cn(
                "w-5 h-5 shrink-0",
                active ? "text-white" : "text-blue-200",
              )} />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 truncate">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Footer: theme toggle + company card */}
      <div className="mx-2 mb-4 space-y-2">
        <div className="px-1">
          <ThemeToggle compact />
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl whitespace-nowrap overflow-hidden">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">LBP Inversiones</p>
            <p className="text-blue-200 text-[11px] leading-tight">y Servicios S.R.L.</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
