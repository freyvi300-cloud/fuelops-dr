"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/",             label: "Dashboard",            icon: LayoutDashboard, primary: false },
  { href: "/suministro",   label: "Registrar suministro", icon: Fuel,            primary: true  },
  { href: "/clientes",     label: "Clientes",             icon: Users,           primary: false },
  { href: "/camiones",     label: "Camiones / Equipos",   icon: Truck,           primary: false },
  { href: "/inventario",   label: "Inventario",           icon: Droplets,        primary: false },
  { href: "/facturas",     label: "Facturas",             icon: Receipt,         primary: false },
  { href: "/cobros",       label: "Cobros",               icon: CircleDollarSign,primary: false },
  { href: "/reportes",     label: "Reportes",             icon: BarChart3,       primary: false },
  { href: "/empleados",    label: "Empleados",            icon: UserCog,         primary: false },
  { href: "/configuracion",label: "Configuración",        icon: Settings,        primary: false },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col min-h-screen bg-[#1a3fa0]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <Droplets className="w-5 h-5 text-[#1a3fa0]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">FuelOps-DR</p>
            <p className="text-blue-200 text-[11px] leading-tight mt-0.5">Control total de tu combustible</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

          // Primary item (Registrar suministro) gets a special treatment
          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? "bg-white text-[#1a3fa0] shadow-sm"
                    : "bg-white/20 text-white hover:bg-white/30"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#1a3fa0]" : "text-white")} />
                {label}
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-blue-100/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-blue-200")} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Company info */}
      <div className="mx-3 mb-4 p-3 bg-white/10 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-semibold leading-tight">Empresa de Distribución</p>
            <p className="text-blue-200 text-[11px] leading-tight">de Diésel</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
