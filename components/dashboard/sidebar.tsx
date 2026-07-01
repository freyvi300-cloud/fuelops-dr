"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Premium spring-like ease: decelerates fast then settles softly
const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)"

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

// ── Label that fades + slides in when sidebar expands ────────────────────────
function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      // Width expansion plays first (450ms), then label fades in (300ms, 80ms offset)
      style={{
        transition: `opacity 280ms ${SPRING} 80ms, transform 300ms ${SPRING} 80ms`,
      }}
      className={cn(
        "whitespace-nowrap overflow-hidden leading-none",
        // Collapsed: invisible and shifted left
        "opacity-0 -translate-x-1 pointer-events-none",
        // Expanded: fully visible, in place
        "group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto",
      )}
    >
      {children}
    </span>
  )
}

// ── Wordmark / sub-text block ─────────────────────────────────────────────────
function FadeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      style={{
        transition: `opacity 280ms ${SPRING} 100ms, transform 300ms ${SPRING} 100ms`,
      }}
      className={cn(
        "overflow-hidden whitespace-nowrap",
        "opacity-0 -translate-x-1",
        "group-hover:opacity-100 group-hover:translate-x-0",
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      // Width: 64 px collapsed → 224 px expanded.
      // Flex layout naturally pushes the sibling content area, so both elements
      // move as one coordinated animation — no JS / context needed.
      style={{
        transition: `width 450ms ${SPRING}`,
        willChange: "width",
      }}
      className={cn(
        "group hidden md:flex flex-col min-h-screen shrink-0 overflow-hidden",
        "w-16 hover:w-56",
        "bg-[#1a3fa0]",
        "shadow-[2px_0_12px_rgba(0,0,0,0.10)]",
      )}
    >
      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-[1.1rem] border-b border-white/10">
        {/* Icon: always visible */}
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-5 h-5 text-[#1a3fa0]" />
        </div>

        {/* Wordmark */}
        <FadeBlock>
          <p className="text-white font-bold text-sm leading-tight">FuelOps-DR</p>
          <p className="text-blue-200 text-[11px] leading-tight mt-0.5">
            Control total de tu combustible
          </p>
        </FadeBlock>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
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
                title={label}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold",
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
                <NavLabel>{label}</NavLabel>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium",
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
              <NavLabel>{label}</NavLabel>
            </Link>
          )
        })}
      </nav>

      {/* ── Company footer ───────────────────────────────────────── */}
      <div className="mx-2 mb-4">
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <FadeBlock>
            <p className="text-white text-xs font-semibold leading-tight">
              Empresa de Distribución
            </p>
            <p className="text-blue-200 text-[11px] leading-tight">de Diésel</p>
          </FadeBlock>
        </div>
      </div>
    </aside>
  )
}
