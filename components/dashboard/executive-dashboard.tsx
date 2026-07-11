"use client"

import Link from "next/link"
import {
  Fuel, DollarSign, TrendingUp, TrendingDown,
  Users, Receipt, AlertTriangle, CheckCircle2,
  Clock, Truck, Droplets, Zap, Bell, ChevronDown,
  ArrowRight, BarChart3, CreditCard, Plus,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/lib/reporting"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  if (n >= 1_000_000) return `RD$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `RD$${(n / 1_000).toFixed(1)}k`
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
}
function fmtRDFull(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short" })
}
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}
function todayLabel() {
  return new Date().toLocaleDateString("es-DO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })
}

const AVATAR_PALETTE = ["bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500","bg-pink-500","bg-indigo-500","bg-emerald-500"]
function avatarColor(name: string) {
  return AVATAR_PALETTE[name.split("").reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length]
}

const CHART_AXIS_STYLE = { fontSize: 11, fill: "#94a3b8", fontFamily: "var(--font-inter)" }
const TOOLTIP_STYLE    = {
  borderRadius: "12px", border: "1px solid #e2e8f0",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "12px",
  fontFamily: "var(--font-inter)",
}

// ─── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, title, href }: { icon: React.ElementType; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-600" />
        <h2 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[11px] font-sans text-blue-600 hover:text-blue-700 font-semibold transition-colors">
          Ver todo <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("bg-white rounded-2xl border border-slate-100", className)}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor,
  label, value, sub, highlight, alert,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: string; highlight?: boolean; alert?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex items-start gap-3",
        highlight ? "bg-[#1a3fa0] border-blue-700" : alert ? "bg-red-50 border-red-100" : "bg-white border-slate-100"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
          highlight ? "text-blue-200" : "text-slate-500")}>{label}</p>
        <p className={cn("text-lg font-bold font-display tracking-tight mt-0.5 leading-tight",
          highlight ? "text-white" : alert ? "text-red-700" : "text-slate-900")}>{value}</p>
        {sub && <p className={cn("text-[10px] font-sans mt-0.5",
          highlight ? "text-blue-200" : "text-slate-400")}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Tank gauge ───────────────────────────────────────────────────────────────

function TankGauge({ pct }: { pct: number }) {
  const clamp = Math.max(0, Math.min(100, pct))
  const color = clamp < 15 ? "bg-red-500" : clamp < 30 ? "bg-amber-500" : "bg-blue-600"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-sans text-slate-500">
        <span>0 gal</span>
        <span className="font-semibold">{clamp.toFixed(1)}%</span>
        <span>20,000 gal</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${clamp}%` }}
        />
      </div>
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ items }: { items: DashboardData["activity"] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Clock className="w-8 h-8 text-slate-200" />
        <p className="text-xs font-sans text-slate-400">Sin actividad registrada hoy.</p>
        <Link href="/suministro" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Registrar primer suministro →</Link>
      </div>
    )
  }

  return (
    <div className="space-y-0 relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-slate-100" />
      {items.map((item, i) => {
        const isSupply = item.type === "supply"
        const dotColor = isSupply ? "bg-blue-600" : "bg-emerald-500"
        return (
          <div key={item.id} className={cn("flex gap-3 py-2.5 relative", i > 0 && "border-t border-slate-50")}>
            {/* Dot */}
            <div className="relative z-10 shrink-0 mt-0.5">
              <div className={cn("w-[9px] h-[9px] rounded-full ring-2 ring-white mt-1.5 ml-[10px]", dotColor)} />
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">{item.customer}</span>
                    {item.truck && (
                      <span className="font-mono text-[10px] font-bold bg-[#1a3fa0] text-white px-1.5 py-0.5 rounded">
                        {item.truck}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide",
                      isSupply ? "text-blue-600" : "text-emerald-600")}>
                      {isSupply ? "Suministro" : "Cobro"}
                    </span>
                    {item.reference && (
                      <span className="text-[10px] font-sans text-slate-400">{item.reference}</span>
                    )}
                    {item.gallons && (
                      <span className="text-[10px] font-sans text-slate-400">{fmtGal(item.gallons)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-bold", isSupply ? "text-slate-800" : "text-emerald-600")}>
                    {fmtRD(item.amount)}
                  </p>
                  <p className="text-[10px] font-sans text-slate-400">{fmtTime(item.time)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Alert cards ──────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: DashboardData["alerts"][0] }) {
  const cfg = {
    critical: { icon: AlertTriangle, iconColor: "text-red-600",    iconBg: "bg-red-50",     border: "border-red-100",     titleColor: "text-red-700",    msgColor: "text-red-600/80" },
    warning:  { icon: AlertTriangle, iconColor: "text-amber-600",  iconBg: "bg-amber-50",   border: "border-amber-100",   titleColor: "text-amber-800",  msgColor: "text-amber-700/80" },
    ok:       { icon: CheckCircle2,  iconColor: "text-emerald-600",iconBg: "bg-emerald-50", border: "border-emerald-100", titleColor: "text-emerald-700",msgColor: "text-emerald-600/80" },
  }[alert.level]
  const Icon = cfg.icon
  return (
    <Link href={alert.link}
      className={cn("flex items-start gap-3 p-4 rounded-2xl border bg-white hover:shadow-md transition-all", cfg.border)}
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.iconBg)}>
        <Icon className={cn("w-4 h-4", cfg.iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-bold leading-tight", cfg.titleColor)}>{alert.title}</p>
        <p className={cn("text-[11px] font-sans mt-0.5 leading-snug", cfg.msgColor)}>{alert.message}</p>
      </div>
    </Link>
  )
}

// ─── Mini chart ───────────────────────────────────────────────────────────────

function MiniChart({ data, color, formatter }: {
  data: Array<{ date: string; value: number }>
  color: string
  formatter: (v: number) => string
}) {
  const hasData = data.some(d => d.value > 0)
  if (!hasData) {
    return (
      <div className="h-[120px] flex flex-col items-center justify-center gap-1">
        <BarChart3 className="w-6 h-6 text-slate-200" />
        <p className="text-[10px] font-sans text-slate-300">Sin datos</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="date" tickFormatter={d => fmtDate(d)} tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} dy={4} interval="preserveStartEnd" />
        <YAxis hide />
        <Tooltip formatter={(v) => [formatter(Number(v)), ""]} contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace("#","")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboard({ data }: { data: DashboardData }) {
  const { kpis, inventory, activity, alerts, topCustomers, customerDebt, truckActivity, charts } = data
  const criticalAlert = alerts.find(a => a.level === "critical")

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {greeting()}, Administrador
            </h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5 capitalize">{todayLabel()}</p>
          </div>

          <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors shrink-0">
            <Bell className="w-5 h-5 text-slate-500" />
            {(kpis.invoicesOverdue > 0 || criticalAlert) && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {kpis.invoicesOverdue || "!"}
              </span>
            )}
          </button>

          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-xl px-2.5 py-2 transition-colors shrink-0">
            <div className="w-8 h-8 bg-[#1a3fa0] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-slate-800 hidden lg:block">Administrador</span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
          </button>
        </div>
      </div>

      {/* ══ SCROLLABLE BODY ══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5">

        {/* ── Critical alert banner ───────────────────────────────────────── */}
        {criticalAlert && (
          <Link href={criticalAlert.link}
            className="flex items-center gap-3 px-4 py-3 bg-red-600 rounded-xl text-white hover:bg-red-700 transition-colors">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{criticalAlert.title}</p>
              <p className="text-[11px] font-sans text-red-100">{criticalAlert.message}</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
          </Link>
        )}

        {/* ── SECCIÓN 8: Acciones rápidas ────────────────────────────────── */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {[
            { label: "Nuevo suministro",         href: "/suministro",  icon: Fuel,     cls: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200" },
            { label: "Entrada combustible",       href: "/inventario",  icon: Droplets, cls: "bg-white hover:border-blue-300 text-slate-700 border border-slate-200" },
            { label: "Registrar cobro",           href: "/cobros",      icon: DollarSign,cls: "bg-white hover:border-blue-300 text-slate-700 border border-slate-200" },
            { label: "Agregar cliente",           href: "/clientes",    icon: Users,    cls: "bg-white hover:border-blue-300 text-slate-700 border border-slate-200" },
            { label: "Agregar camión",            href: "/camiones",    icon: Truck,    cls: "bg-white hover:border-blue-300 text-slate-700 border border-slate-200" },
          ].map(a => {
            const Icon = a.icon
            return (
              <Link key={a.href} href={a.href}
                className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0", a.cls)}
                style={{ boxShadow: "var(--shadow-card)" }}>
                <Plus className="w-3.5 h-3.5" />
                <Icon className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">{a.label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── SECCIÓN 1: KPI cards (2 rows) ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard icon={Fuel}         iconBg="bg-white/20"    iconColor="text-white"
            label="Combustible disp." value={fmtGal(inventory.available)}
            sub={`${inventory.percentage.toFixed(1)}% del tanque`} highlight />
          <KpiCard icon={TrendingUp}   iconBg="bg-blue-50"     iconColor="text-blue-600"
            label="Ventas hoy"        value={fmtRD(kpis.salesToday)}
            sub={`${kpis.gallonsSoldToday.toFixed(0)} gal vendidos`} />
          <KpiCard icon={DollarSign}   iconBg="bg-emerald-50"  iconColor="text-emerald-600"
            label="Cobrado hoy"       value={fmtRD(kpis.collectedToday)}
            sub="Pagos recibidos" />
          <KpiCard icon={CreditCard}   iconBg="bg-amber-50"    iconColor="text-amber-500"
            label="Pendiente cobrar"  value={fmtRD(kpis.pendingBalance)}
            sub="Saldo abierto total" />
          <KpiCard icon={Users}        iconBg="bg-violet-50"   iconColor="text-violet-600"
            label="Clientes activos"  value={kpis.activeCustomers.toString()}
            sub="En el sistema" />
          <KpiCard icon={Receipt}      iconBg="bg-red-50"      iconColor="text-red-500"
            label="Facturas vencidas" value={kpis.invoicesOverdue.toString()}
            sub="Requieren atención"  alert={kpis.invoicesOverdue > 0} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={TrendingUp}   iconBg="bg-blue-50"    iconColor="text-blue-600"
            label="Ventas del mes"    value={fmtRD(kpis.salesThisMonth)}
            sub={`${kpis.gallonsSoldThisMonth.toFixed(0)} gal este mes`} />
          <KpiCard icon={DollarSign}   iconBg="bg-emerald-50" iconColor="text-emerald-600"
            label="Cobrado este mes"  value={fmtRD(kpis.collectedThisMonth)}
            sub="Total del mes" />
          <KpiCard icon={Droplets}     iconBg="bg-amber-50"   iconColor="text-amber-500"
            label="Consumo hoy"       value={fmtGal(inventory.consumedToday)}
            sub="Galones despachados" />
          <KpiCard icon={Clock}        iconBg="bg-slate-100"  iconColor="text-slate-600"
            label="Autonomía estimada"
            value={inventory.estimatedDaysLeft === Infinity ? "—" : `${inventory.estimatedDaysLeft} días`}
            sub="Al ritmo actual" />
        </div>

        {/* ── SECCIÓN 2 + 3: Activity + Clientes atención ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Activity feed (3/5) */}
          <Card className="xl:col-span-3 p-5">
            <SectionHead icon={Zap} title="Actividad de hoy" href="/facturas" />
            <ActivityFeed items={activity} />
          </Card>

          {/* Clientes que necesitan atención (2/5) */}
          <Card className="xl:col-span-2 p-5">
            <SectionHead icon={AlertTriangle} title="Requieren atención" href="/cobros" />
            {customerDebt.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-xs font-sans text-slate-500 text-center">Sin saldos pendientes.<br />¡Todo al día!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {customerDebt.map(c => (
                  <div key={c.customerId} className="flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.customerName))}>
                      {c.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.customerName}</p>
                      <p className="text-[10px] font-sans text-slate-400">
                        {c.overdueInvoices > 0 && <span className="text-red-500 font-semibold">{c.overdueInvoices} vencida{c.overdueInvoices > 1 ? "s" : ""} · </span>}
                        {fmtGal(c.pendingGallons)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-red-600 shrink-0">{fmtRD(c.currentBalance)}</span>
                  </div>
                ))}
                <Link href="/clientes" className="block text-center text-[11px] font-sans text-blue-600 hover:text-blue-700 font-semibold pt-2 border-t border-slate-100 mt-2">
                  Ver todos los clientes →
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* ── SECCIÓN 4: Inventario ─────────────────────────────────────────── */}
        <Card className="p-5">
          <SectionHead icon={Fuel} title="Estado del inventario" href="/inventario" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Gauge + autonomy */}
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold font-display text-slate-900 tracking-tight">
                  {fmtGal(inventory.available)}
                </span>
                <span className="text-sm font-sans text-slate-400">disponibles</span>
              </div>
              <TankGauge pct={inventory.percentage} />
              <p className={cn("text-xs font-sans mt-3 leading-relaxed",
                inventory.estimatedDaysLeft < 5 ? "text-red-600 font-semibold" :
                inventory.estimatedDaysLeft < 10 ? "text-amber-600" : "text-slate-500")}>
                {inventory.estimatedDaysLeft === Infinity
                  ? "Sin datos de consumo. Registra suministros para ver la autonomía."
                  : `Al ritmo actual, queda combustible para aproximadamente ${inventory.estimatedDaysLeft} día${inventory.estimatedDaysLeft !== 1 ? "s" : ""}.`
                }
              </p>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Consumo hoy",          value: fmtGal(inventory.consumedToday),                icon: TrendingDown, color: "text-red-500",    bg: "bg-red-50" },
                { label: "Consumo este mes",      value: fmtGal(inventory.consumedThisMonth),            icon: TrendingDown, color: "text-amber-500",  bg: "bg-amber-50" },
                { label: "Promedio diario",       value: fmtGal(inventory.avgDailyConsumption),          icon: BarChart3,    color: "text-blue-600",   bg: "bg-blue-50" },
                { label: "Capacidad del tanque",  value: `${inventory.tankCapacity.toLocaleString()} gal`, icon: Fuel,         color: "text-slate-600",  bg: "bg-slate-100" },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", s.bg)}>
                        <Icon className={cn("w-3 h-3", s.color)} />
                      </div>
                      <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">{s.label}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{s.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* ── SECCIÓN 5 + 6: Top clientes + Camiones ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Top clientes */}
          <Card className="p-5">
            <SectionHead icon={Users} title="Top clientes del mes" href="/clientes" />
            {topCustomers.length === 0 ? (
              <p className="text-xs font-sans text-slate-400 text-center py-6">Sin ventas este mes todavía.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.slice(0, 8).map(c => {
                  const maxRevenue = topCustomers[0].revenue
                  const pct = maxRevenue > 0 ? (c.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={c.customerId} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 w-4 text-right shrink-0">{c.rank}</span>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0", avatarColor(c.customerName))}>
                        {c.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{c.customerName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-sans text-slate-400 shrink-0">{fmtGal(c.gallons)}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-800 shrink-0">{fmtRD(c.revenue)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Camiones */}
          <Card className="p-5">
            <SectionHead icon={Truck} title="Actividad por camiones" href="/camiones" />
            {truckActivity.length === 0 ? (
              <p className="text-xs font-sans text-slate-400 text-center py-6">Sin actividad de camiones este mes.</p>
            ) : (
              <div className="space-y-2.5">
                {truckActivity.map(t => (
                  <div key={t.truckId} className="flex items-center gap-3">
                    <span className="bg-[#1a3fa0] text-white text-[10px] font-bold px-2 py-0.5 rounded-lg tracking-widest font-mono shrink-0">
                      {t.truckCode}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{t.truckName}</p>
                      <p className="text-[10px] font-sans text-slate-400">
                        {t.customerName} · {t.supplyCount} suministro{t.supplyCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-blue-600">{fmtGal(t.totalGallons)}</p>
                      {t.lastSupplyDate && (
                        <p className="text-[10px] font-sans text-slate-400">{fmtDate(t.lastSupplyDate)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── SECCIÓN 7: Alertas ───────────────────────────────────────────── */}
        <div>
          <SectionHead icon={AlertTriangle} title="Alertas del sistema" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
          </div>
        </div>

        {/* ── SECCIÓN 9: Gráficos ──────────────────────────────────────────── */}
        <div>
          <SectionHead icon={BarChart3} title="Últimos 30 días" href="/reportes" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Card className="p-5">
              <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Ventas (RD$)
              </p>
              <MiniChart data={charts.salesLast30} color="#2563eb" formatter={fmtRDFull} />
            </Card>

            <Card className="p-5">
              <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Cobros (RD$)
              </p>
              <MiniChart data={charts.collectionsLast30} color="#10b981" formatter={fmtRDFull} />
            </Card>

            <Card className="p-5">
              <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-amber-500" /> Galones vendidos
              </p>
              <MiniChart data={charts.gallonsLast30} color="#f59e0b" formatter={v => `${v.toFixed(2)} gal`} />
            </Card>

            <Card className="p-5">
              <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-blue-600" /> Inventario histórico (gal)
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={charts.inventoryLast30} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} dy={4} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} gal`, "Inventario"]} contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] font-sans text-slate-400 pb-2">
          © 2025 LBP Inversiones y Servicios S.R.L. — Todos los datos calculados desde{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px]">lib/reporting.ts</code>
        </p>
      </div>
    </div>
  )
}
