"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/",              label: "Dashboard",            icon: LayoutDashboard, primary: false },
  { href: "/suministro",    label: "Registrar suministro", icon: Fuel,            primary: true  },
  { href: "/clientes",      label: "Clientes",             icon: Users,           primary: false },
  { href: "/camiones",      label: "Camiones / Equipos",   icon: Truck,           primary: false },
  { href: "/inventario",    label: "Inventario",           icon: Droplets,        primary: false },
  { href: "/facturas",      label: "Facturas",             icon: Receipt,         primary: false },
  { href: "/cobros",        label: "Cobros",               icon: CircleDollarSign,primary: false },
  { href: "/reportes",      label: "Reportes",             icon: BarChart3,       primary: false },
  { href: "/empleados",     label: "Empleados",            icon: UserCog,         primary: false },
  { href: "/configuracion", label: "Configuración",        icon: Settings,        primary: false },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        // Layout
        "group hidden md:flex flex-col min-h-screen shrink-0 overflow-hidden",
        // Collapsed: 64 px wide · Expanded: 224 px wide
        "w-16 hover:w-56",
        // Smooth width + shadow transition
        "transition-[width] duration-300 ease-in-out",
        // Brand colour
        "bg-[#1a3fa0]",
        // Subtle right-edge shadow so content area has visual separation
        "shadow-[4px_0_16px_rgba(0,0,0,0.08)]",
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-[1.1rem] border-b border-white/10 overflow-hidden">
        {/* Icon – always visible */}
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-5 h-5 text-[#1a3fa0]" />
        </div>

        {/* Wordmark – fades in with the expansion */}
        <div className={cn(
          "flex flex-col overflow-hidden whitespace-nowrap",
          "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
          "transition-[opacity,transform] duration-200 delay-100",
        )}>
          <span className="text-white font-bold text-sm leading-tight">FuelOps-DR</span>
          <span className="text-blue-200 text-[11px] leading-tight mt-0.5">
            Control total de tu combustible
          </span>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ href, label, icon: Icon, primary }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`)

          const sharedLabel = (
            <span className={cn(
              "text-sm font-semibold whitespace-nowrap overflow-hidden",
              "opacity-0 translate-x-1",
              "group-hover:opacity-100 group-hover:translate-x-0",
              "transition-[opacity,transform] duration-200 delay-100",
            )}>
              {label}
            </span>
          )

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-semibold",
                  "transition-colors duration-150",
                  active
                    ? "bg-white text-[#1a3fa0] shadow-sm"
                    : "bg-white/20 text-white hover:bg-white/30",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    active ? "text-[#1a3fa0]" : "text-white",
                  )}
                />
                {sharedLabel}
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-medium",
                "transition-colors duration-150",
                active
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-blue-100/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  active ? "text-white" : "text-blue-200",
                )}
              />
              {sharedLabel}
            </Link>
          )
        })}
      </nav>

      {/* ── Company footer ───────────────────────────────────────── */}
      <div className="mx-2 mb-4 overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div className={cn(
            "flex flex-col overflow-hidden whitespace-nowrap",
            "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
            "transition-[opacity,transform] duration-200 delay-100",
          )}>
            <span className="text-white text-xs font-semibold leading-tight">
              Empresa de Distribución
            </span>
            <span className="text-blue-200 text-[11px] leading-tight">de Diésel</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
