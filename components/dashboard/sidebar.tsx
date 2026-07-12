"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings, MessageCircle,
  TrendingUp, Sun, Moon, Monitor, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/theme/theme-toggle"
import { useTheme } from "@/components/theme/theme-provider"
import { signOut } from "next-auth/react"

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

const themeIcons: Record<string, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  // Cycle through light → dark → system on single-button click
  const cycleTheme = () => {
    const order = ["light", "dark", "system"] as const
    const next = order[(order.indexOf(theme as typeof order[number]) + 1) % 3]
    setTheme(next)
  }

  const ActiveThemeIcon = themeIcons[theme] ?? Monitor

  return (
    <aside className={cn(
      // Fixed overlay — expands on hover without shifting flex layout.
      // The layout holds a permanent w-16 spacer div.
      "group hidden md:flex flex-col fixed left-0 top-0 z-40 h-screen overflow-hidden",
      "w-16 hover:w-56 transition-[width] duration-300 ease-in-out",
      "bg-[#1a3fa0] dark:bg-[#0f2660]",
      "shadow-[2px_0_12px_rgba(0,0,0,0.10)] dark:shadow-[2px_0_20px_rgba(0,0,0,0.35)]",
    )}>

      {/* ── Logo row ───────────────────────────────────────────── */}
      {/*
        Icon is positioned so its center sits at 32 px (= 64 px / 2):
        8 px sidebar mx + 14 px link px-3.5 + 10 px (half w-5 icon) = 32 px
      */}
      <div className="flex items-center gap-3 px-3 py-[1.1rem] border-b border-white/10 min-w-[14rem]">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-5 h-5 text-[#1a3fa0]" />
        </div>
        {/* Text fades in after width animation starts */}
        <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">LBP</p>
          <p className="text-blue-200 text-[11px] leading-tight mt-0.5">
            Inversiones y Servicios S.R.L.
          </p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
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
                  // group/item scoped so hover doesn't bleed to sidebar's group
                  "group/item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap",
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
                "group/item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap",
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
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 truncate">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="mx-2 mb-4 space-y-2">

        {/* Logout — two versions stacked; icon-only when collapsed, icon+label when expanded */}
        <div className="relative h-9">
          {/* COLLAPSED: centered icon */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-opacity duration-150",
            "group-hover:opacity-0 group-hover:pointer-events-none",
          )}>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Cerrar sesión"
              className="w-10 h-9 flex items-center justify-center rounded-lg text-blue-300 hover:bg-white/10 hover:text-white transition-colors duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {/* EXPANDED: icon + label */}
          <div className={cn(
            "absolute inset-0 flex items-center px-1",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            "transition-opacity duration-200 delay-100",
          )}>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors duration-200 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Theme toggle — two versions stacked absolutely within a fixed-height container */}
        <div className="relative h-9">
          {/* COLLAPSED: single cycle button, centered at 32 px */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-opacity duration-150",
            "group-hover:opacity-0 group-hover:pointer-events-none",
          )}>
            <button
              onClick={cycleTheme}
              title={`Tema: ${theme}`}
              className="w-10 h-9 flex items-center justify-center rounded-lg bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white transition-colors duration-200"
            >
              <ActiveThemeIcon className="w-4 h-4" />
            </button>
          </div>

          {/* EXPANDED: full 3-button ThemeToggle */}
          <div className={cn(
            "absolute inset-0 flex items-center px-1",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            "transition-opacity duration-200 delay-100",
          )}>
            <ThemeToggle compact className="w-full" />
          </div>
        </div>

        {/* Company card — two versions stacked absolutely */}
        <div className="relative h-[52px]">
          {/* COLLAPSED: truck icon centered */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-opacity duration-150",
            "group-hover:opacity-0 group-hover:pointer-events-none",
          )}>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* EXPANDED: full card with text */}
          <div className={cn(
            "absolute inset-0 flex items-center gap-3 p-3 bg-white/10 rounded-xl overflow-hidden",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            "transition-opacity duration-200 delay-100",
          )}>
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 whitespace-nowrap">
              <p className="text-white text-xs font-semibold leading-tight truncate">LBP Inversiones</p>
              <p className="text-blue-200 text-[11px] leading-tight">y Servicios S.R.L.</p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
