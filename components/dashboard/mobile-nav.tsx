"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Menu, X, LayoutDashboard, Fuel, Users, Truck, Droplets,
  Receipt, CircleDollarSign, BarChart3, UserCog, Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/theme/theme-toggle"

// ─── Nav items (mirrors sidebar) ─────────────────────────────────────────────

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

const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)"

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileNav() {
  const [open, setOpen]     = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname            = usePathname()

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Close on Escape
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false)
  }, [])
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey])

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    // Only rendered on mobile — hidden md and up
    <div className="md:hidden">

      {/* ── Hamburger button — fixed top-left ─────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className={cn(
          "fixed top-3.5 left-4 z-40",
          "w-10 h-10 flex items-center justify-center",
          "rounded-xl bg-[#1a3fa0] text-white shadow-lg",
          "transition-transform active:scale-95",
        )}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        onClick={() => setOpen(false)}
        style={{
          transition: `opacity 350ms ${SPRING}`,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
      />

      {/* ── Drawer ────────────────────────────────────────────── */}
      <div
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: `transform 420ms ${SPRING}`,
          willChange: "transform",
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50",
          "w-72 flex flex-col",
          "bg-[#1a3fa0]",
          "shadow-[8px_0_32px_rgba(0,0,0,0.25)]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <Droplets className="w-4 h-4 text-[#1a3fa0]" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">FuelOps-DR</p>
              <p className="text-blue-200 text-[11px] leading-tight">Control total</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, primary }) => {
            const active =
              href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

            if (primary) {
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors",
                    active
                      ? "bg-white text-[#1a3fa0] shadow-sm"
                      : "bg-white/20 text-white hover:bg-white/30",
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0", active ? "text-[#1a3fa0]" : "text-white")} />
                  {label}
                </Link>
              )
            }

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-blue-100/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", active ? "text-white" : "text-blue-200")} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: theme toggle */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider">Tema</p>
          <ThemeToggle compact className="w-full justify-start" />
        </div>
      </div>
    </div>
  )
}
