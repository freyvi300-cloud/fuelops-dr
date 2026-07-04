"use client"

import { useRouter }    from "next/navigation"
import { useState }     from "react"
import Link             from "next/link"
import {
  BarChart3, TrendingUp, TrendingDown, Droplets, Users,
  Receipt, DollarSign, Truck, FileDown, Bell, ChevronDown,
  AlertCircle, CheckCircle2, Clock, Fuel, Calendar, X, Filter,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { cn }           from "@/lib/utils"
import type { FullReport, Period } from "@/lib/reporting"
import WeeklyReportClient from "./weekly-report-client"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short" })
}
function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo", TRANSFER: "Transferencia",
  BANK_DEPOSIT: "Depósito", CHECK: "Cheque", OTHER: "Otro",
}

// ─── Period filter ────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoy"         },
  { value: "week",  label: "Esta semana" },
  { value: "month", label: "Este mes"    },
  { value: "year",  label: "Este año"    },
]

function PeriodFilter({
  active, customers, activeDateFrom, activeDateTo, activeCustomerId,
}: {
  active: Period
  customers: { id: string; name: string }[]
  activeDateFrom?: string
  activeDateTo?:   string
  activeCustomerId?: string
}) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(activeDateFrom ?? "")
  const [dateTo,   setDateTo]   = useState(activeDateTo   ?? "")
  const [custId,   setCustId]   = useState(activeCustomerId ?? "")

  function navigate(params: Record<string, string>) {
    const p = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v) })
    router.push(`/reportes${p.size ? `?${p}` : ""}`)
  }

  function applyCustom() {
    if (!dateFrom && !dateTo) return
    const p: Record<string, string> = {}
    if (dateFrom) p.from = dateFrom
    if (dateTo)   p.to   = dateTo
    if (custId)   p.customerId = custId
    navigate(p)
  }

  const inputCls = "pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"

  return (
    <div className="space-y-3">
      {/* Period presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => { setDateFrom(""); setDateTo(""); setCustId(""); navigate({ period: p.value, customerId: custId }) }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
              active === p.value && !activeDateFrom
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
            style={{ boxShadow: (active === p.value && !activeDateFrom) ? undefined : "var(--shadow-card)" }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range + client */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rango personalizado:</span>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <span className="text-slate-400 text-xs">—</span>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Client filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select value={custId} onChange={e => setCustId(e.target.value)}
            className="pl-8 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all appearance-none cursor-pointer">
            <option value="">Todos los clientes</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={applyCustom}
          disabled={!dateFrom && !dateTo}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#1a3fa0] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#163490] transition-colors shadow-sm"
        >
          Aplicar
        </button>

        {(activeDateFrom || activeDateTo || activeCustomerId) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); setCustId(""); navigate({ period: "month" }) }}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor,
  label, value, sub, alert, highlight,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: string; alert?: boolean; highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex items-center gap-3",
        highlight ? "bg-[#1a3fa0] border-blue-700" : "bg-white border-slate-100",
        alert && "border-red-200"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
          highlight ? "text-blue-200" : "text-slate-500")}>{label}</p>
        <p className={cn("text-lg font-bold font-display tracking-tight leading-tight mt-0.5",
          highlight ? "text-white" : alert ? "text-red-600" : "text-slate-900")}>{value}</p>
        {sub && <p className={cn("text-[10px] font-sans mt-0.5",
          highlight ? "text-blue-200" : "text-slate-400")}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Chart wrapper ────────────────────────────────────────────────────────────

function ChartCard({ title, icon: Icon, children, empty }: {
  title: string; icon: React.ElementType; children: React.ReactNode; empty?: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-blue-600" />
        <h3 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h3>
      </div>
      {empty ? (
        <div className="h-[180px] flex flex-col items-center justify-center gap-2">
          <BarChart3 className="w-8 h-8 text-slate-200" />
          <p className="text-xs font-sans text-slate-400">Sin datos para el período seleccionado</p>
        </div>
      ) : children}
    </div>
  )
}

const CHART_AXIS = { fontSize: 11, fill: "#94a3b8", fontFamily: "var(--font-inter)" }
const CHART_TOOLTIP_STYLE = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  color: "var(--chart-tooltip-color)",
  borderRadius: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  fontSize: "12px",
  fontFamily: "var(--font-inter)",
}

// ─── TAB CONTENTS ─────────────────────────────────────────────────────────────

function SalesTab({ report }: { report: FullReport }) {
  const { sales, charts } = report
  const hasData = sales.transactionCount > 0
  const dataPoints = charts.salesByDay.filter(d => d.value > 0).length

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: "Total vendido",       value: fmtRD(sales.totalAmount),      icon: DollarSign, bg: "bg-blue-50",    color: "text-blue-600" },
          { label: "Galones totales",     value: fmtGal(sales.totalGallons),     icon: Droplets,   bg: "bg-amber-50",   color: "text-amber-500" },
          { label: "Ventas efectivo",     value: fmtRD(sales.cashSales),         icon: DollarSign, bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Ventas crédito",      value: fmtRD(sales.creditSales),       icon: Receipt,    bg: "bg-violet-50",  color: "text-violet-600" },
          { label: "Precio prom./gal",    value: fmtRD(sales.avgPricePerGallon), icon: Fuel,       bg: "bg-slate-100",  color: "text-slate-600" },
        ].map(m => (
          <KpiCard key={m.label} icon={m.icon} iconBg={m.bg} iconColor={m.color}
            label={m.label} value={hasData ? m.value : "—"} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ChartCard title="Ventas por día (RD$)" icon={TrendingUp} empty={dataPoints === 0}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={charts.salesByDay} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={CHART_AXIS} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `RD$${(v/1000).toFixed(0)}k`} tick={CHART_AXIS} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v) => [fmtRD(Number(v)), "Ventas"]} contentStyle={CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#salesGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Galones vendidos por día" icon={Droplets} empty={dataPoints === 0}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={charts.gallonsByDay} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="galGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={CHART_AXIS} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
              <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} width={45} />
              <Tooltip formatter={(v) => [fmtGal(Number(v)), "Galones"]} contentStyle={CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#galGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function CollectionsTab({ report }: { report: FullReport }) {
  const { collections, charts } = report
  const hasData = collections.transactionCount > 0
  const dataPoints = charts.collectionsByDay.filter(d => d.value > 0).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          label="Total cobrado" value={hasData ? fmtRD(collections.totalCollected) : "—"} />
        <KpiCard icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600"
          label="Transacciones" value={hasData ? collections.transactionCount.toString() : "—"} />
        <KpiCard icon={DollarSign} iconBg="bg-violet-50" iconColor="text-violet-600"
          label="Promedio por cobro"
          value={hasData && collections.transactionCount > 0
            ? fmtRD(collections.totalCollected / collections.transactionCount)
            : "—"} />
      </div>

      {/* By method breakdown */}
      {collections.byMethod.length > 0 && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-bold text-slate-800 text-sm mb-4">Cobros por método de pago</h3>
          <div className="space-y-3">
            {collections.byMethod.map(m => {
              const pct = collections.totalCollected > 0 ? (m.amount / collections.totalCollected) * 100 : 0
              return (
                <div key={m.method}>
                  <div className="flex items-center justify-between text-xs font-sans mb-1">
                    <span className="font-semibold text-slate-700">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{m.count} cobro{m.count !== 1 ? "s" : ""}</span>
                      <span className="font-bold text-slate-800">{fmtRD(m.amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ChartCard title="Cobros por día (RD$)" icon={BarChart3} empty={dataPoints === 0}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={charts.collectionsByDay} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={CHART_AXIS} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `RD$${(v/1000).toFixed(0)}k`} tick={CHART_AXIS} axisLine={false} tickLine={false} width={55} />
            <Tooltip formatter={(v) => [fmtRD(Number(v)), "Cobros"]} contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function InventoryTab({ report }: { report: FullReport }) {
  const { inventory, charts } = report
  const dataPoints = charts.inventoryOverTime.filter((d, i) =>
    i === 0 || d.value !== charts.inventoryOverTime[i-1].value
  ).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: "Balance inicial",   value: fmtGal(inventory.openingBalance),   bg: "bg-slate-100",  color: "text-slate-600", icon: Droplets },
          { label: "Entradas (+)",      value: fmtGal(inventory.totalIn),          bg: "bg-emerald-50", color: "text-emerald-600", icon: TrendingUp },
          { label: "Salidas (−)",       value: fmtGal(inventory.totalOut),         bg: "bg-red-50",     color: "text-red-500",   icon: TrendingDown },
          { label: "Ajustes (±)",       value: fmtGal(inventory.totalAdjustments), bg: "bg-amber-50",   color: "text-amber-500", icon: BarChart3 },
          { label: "Balance actual",    value: fmtGal(inventory.currentBalance),   bg: "bg-blue-50",    color: "text-blue-600",  icon: Fuel },
        ].map(m => (
          <KpiCard key={m.label} icon={m.icon} iconBg={m.bg} iconColor={m.color} label={m.label} value={m.value} />
        ))}
      </div>

      <ChartCard title="Nivel de inventario en el tiempo (gal)" icon={Fuel} empty={dataPoints <= 1}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={charts.inventoryOverTime} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={CHART_AXIS} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(v) => [fmtGal(Number(v)), "Inventario"]} contentStyle={CHART_TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function CustomersTab({ report }: { report: FullReport }) {
  const { customerDebt } = report
  if (customerDebt.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 py-16 flex flex-col items-center gap-3"
        style={{ boxShadow: "var(--shadow-card)" }}>
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        <p className="font-semibold text-slate-700">No hay clientes con saldo pendiente</p>
        <p className="text-xs text-slate-400">Todos los balances están en cero.</p>
      </div>
    )
  }
  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
              {["#","CLIENTE","TELÉFONO","BALANCE (RD$)","GALONES PEND.","FACT. VENCIDAS","ÚLTIMO SUMINISTRO"].map((h, i) => (
                <th key={h} className={cn("text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3",
                  i === 0 ? "pl-5 pr-2 text-center w-10" : i >= 3 ? "text-right px-4" : "text-left px-4")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {customerDebt.map((c, i) => (
              <tr key={c.customerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="pl-5 pr-2 py-3 text-center">
                  <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{c.customerName}</td>
                <td className="px-4 py-3 text-slate-500 font-sans">{c.customerPhone ?? "—"}</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">{fmtRD(c.currentBalance)}</td>
                <td className="px-4 py-3 text-right text-blue-600 font-semibold">{fmtGal(c.pendingGallons)}</td>
                <td className="px-4 py-3 text-right">
                  {c.overdueInvoices > 0
                    ? <span className="text-red-600 font-bold">{c.overdueInvoices}</span>
                    : <span className="text-slate-400">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-right text-slate-500 font-sans">
                  {c.lastSupplyDate ? fmtDateFull(c.lastSupplyDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <td colSpan={3} className="pl-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                TOTALES ({customerDebt.length} clientes)
              </td>
              <td className="px-4 py-3 text-right font-bold text-red-600 text-sm">
                {fmtRD(customerDebt.reduce((s, c) => s + c.currentBalance, 0))}
              </td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 text-sm">
                {fmtGal(customerDebt.reduce((s, c) => s + c.pendingGallons, 0))}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function InvoicesTab({ report }: { report: FullReport }) {
  const { invoiceStatus: s } = report
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: "Total",           value: s.total.toString(),        bg: "bg-slate-100",  color: "text-slate-700",   icon: Receipt },
          { label: "Pendientes",      value: s.pending.toString(),      bg: "bg-amber-50",   color: "text-amber-600",   icon: Clock },
          { label: "Pago parcial",    value: s.partiallyPaid.toString(),bg: "bg-blue-50",    color: "text-blue-600",    icon: DollarSign },
          { label: "Pagadas",         value: s.paid.toString(),         bg: "bg-emerald-50", color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Vencidas",        value: s.overdue.toString(),      bg: "bg-red-50",     color: "text-red-600",     icon: AlertCircle, alert: s.overdue > 0 },
        ].map(m => (
          <KpiCard key={m.label} icon={m.icon} iconBg={m.bg} iconColor={m.color}
            label={m.label} value={m.value} alert={m.alert} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Total pendiente por cobrar</p>
          <p className="text-2xl font-bold text-red-700 font-display mt-1">{fmtRD(s.totalPendingAmount)}</p>
          <p className="text-xs text-red-400 mt-1 font-sans">Facturas pendientes, parciales y vencidas</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Total cobrado (pagadas)</p>
          <p className="text-2xl font-bold text-emerald-700 font-display mt-1">{fmtRD(s.totalPaidAmount)}</p>
          <p className="text-xs text-emerald-500 mt-1 font-sans">Solo facturas con estado PAID</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/facturas" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-semibold">
          Ver todas las facturas →
        </Link>
      </div>
    </div>
  )
}

function TrucksTab({ report }: { report: FullReport }) {
  const { truckActivity } = report
  if (truckActivity.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 py-16 flex flex-col items-center gap-3"
        style={{ boxShadow: "var(--shadow-card)" }}>
        <Truck className="w-10 h-10 text-slate-300" />
        <p className="font-semibold text-slate-700">Sin actividad de camiones para este período</p>
        <p className="text-xs text-slate-400">Registra suministros para ver estadísticas por equipo.</p>
      </div>
    )
  }
  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
              {["CÓDIGO","NOMBRE","CLIENTE","SUMINISTROS","GALONES TOTALES","ÚLTIMO SUMINISTRO"].map((h, i) => (
                <th key={h} className={cn("text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3",
                  i === 0 ? "pl-5 pr-4 text-left" : i >= 3 ? "text-right px-4" : "text-left px-4")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {truckActivity.map(t => (
              <tr key={t.truckId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="pl-5 pr-4 py-3">
                  <span className="bg-[#1a3fa0] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-widest font-mono">
                    {t.truckCode}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{t.truckName}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{t.customerName}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t.supplyCount}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{fmtGal(t.totalGallons)}</td>
                <td className="px-4 py-3 text-right text-slate-500 font-sans">
                  {t.lastSupplyDate ? fmtDateFull(t.lastSupplyDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: "ventas",     label: "Ventas",     icon: TrendingUp   },
  { id: "cobros",     label: "Cobros",     icon: DollarSign   },
  { id: "inventario", label: "Inventario", icon: Droplets     },
  { id: "clientes",   label: "Clientes",   icon: Users        },
  { id: "facturas",   label: "Facturas",   icon: Receipt      },
  { id: "camiones",   label: "Camiones",   icon: Truck        },
] as const
type TabId = typeof TABS[number]["id"]

interface Props {
  report:          FullReport
  activePeriod:    Period
  customers:       { id: string; name: string }[]
  activeDateFrom?: string
  activeDateTo?:   string
  activeCustomerId?: string
}

export default function ReportsClient({ report, activePeriod, customers, activeDateFrom, activeDateTo, activeCustomerId }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("ventas")
  const [view, setView] = useState<"dashboard" | "weekly">("dashboard")
  const { kpis, dateRange } = report

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-4 sm:px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Reportes</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              {view === "weekly" ? "Reportes semanales por cliente" : "Métricas y análisis del negocio"}
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5 shrink-0">
            <button
              onClick={() => setView("dashboard")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                view === "dashboard" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}>
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setView("weekly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                view === "weekly" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}>
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reportes </span>semanales
            </button>
          </div>
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Weekly report view ──────────────────────────────────────────── */}
        {view === "weekly" && <WeeklyReportClient customers={customers} />}

        {/* ── Dashboard view ──────────────────────────────────────────────── */}
        {view === "dashboard" && <>

        {/* Period filter + date label */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PeriodFilter active={activePeriod} customers={customers}
            activeDateFrom={activeDateFrom} activeDateTo={activeDateTo} activeCustomerId={activeCustomerId} />
          <p className="text-xs font-sans text-slate-400 bg-white border border-slate-200 px-3 py-2 rounded-xl"
            style={{ boxShadow: "var(--shadow-card)" }}>
            {new Date(dateRange.from).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
            {" — "}
            {new Date(dateRange.to).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* ── Dashboard KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard icon={DollarSign}  iconBg="bg-white/20"    iconColor="text-white"
            label="Ventas hoy"        value={fmtRD(kpis.salesToday)}          highlight />
          <KpiCard icon={DollarSign}  iconBg="bg-blue-50"     iconColor="text-blue-600"
            label="Ventas del mes"    value={fmtRD(kpis.salesThisMonth)} />
          <KpiCard icon={Droplets}    iconBg="bg-amber-50"    iconColor="text-amber-500"
            label="Galones hoy"       value={fmtGal(kpis.gallonsSoldToday)} />
          <KpiCard icon={Droplets}    iconBg="bg-amber-50"    iconColor="text-amber-500"
            label="Galones del mes"   value={fmtGal(kpis.gallonsSoldThisMonth)} />
          <KpiCard icon={Fuel}        iconBg="bg-blue-50"     iconColor="text-blue-600"
            label="Combustible disp." value={fmtGal(kpis.fuelAvailable)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard icon={DollarSign}  iconBg="bg-emerald-50"  iconColor="text-emerald-600"
            label="Cobrado hoy"       value={fmtRD(kpis.collectedToday)} />
          <KpiCard icon={DollarSign}  iconBg="bg-emerald-50"  iconColor="text-emerald-600"
            label="Cobrado del mes"   value={fmtRD(kpis.collectedThisMonth)} />
          <KpiCard icon={Users}       iconBg="bg-violet-50"   iconColor="text-violet-600"
            label="Clientes activos"  value={kpis.activeCustomers.toString()} />
          <KpiCard icon={Clock}       iconBg="bg-amber-50"    iconColor="text-amber-500"
            label="Fact. pendientes"  value={kpis.invoicesPending.toString()} />
          <KpiCard icon={AlertCircle} iconBg="bg-red-50"      iconColor="text-red-500"
            label="Fact. vencidas"    value={kpis.invoicesOverdue.toString()}
            alert={kpis.invoicesOverdue > 0} />
        </div>

        {/* ── Report tabs ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Tab bar */}
          <div className="flex items-center border-b border-slate-100 px-2 overflow-x-auto">
            {TABS.map(tab => {
              const Icon    = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap",
                    isActive
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === "ventas"     && <SalesTab       report={report} />}
            {activeTab === "cobros"     && <CollectionsTab report={report} />}
            {activeTab === "inventario" && <InventoryTab   report={report} />}
            {activeTab === "clientes"   && <CustomersTab   report={report} />}
            {activeTab === "facturas"   && <InvoicesTab    report={report} />}
            {activeTab === "camiones"   && <TrucksTab      report={report} />}
          </div>
        </div>

        {/* Architecture note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <BarChart3 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs font-sans text-blue-700 leading-relaxed">
            <span className="font-bold">Reportes semanales:</span>{" "}
            Usa la pestaña <strong>Reportes semanales</strong> para generar y exportar reportes por cliente
            en PDF, Excel o PNG — uno por cliente o todos en ZIP.
          </p>
        </div>

        </>}
      </div>
    </div>
  )
}
