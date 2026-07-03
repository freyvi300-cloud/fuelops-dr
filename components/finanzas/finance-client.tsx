"use client"

import { useState, useTransition } from "react"
import {
  TrendingUp, Banknote, ArrowRightLeft, Wallet, Receipt,
  Droplets, Users, BarChart3, FileDown, ShoppingBag, CreditCard,
  AlertCircle, ChevronDown, Calendar, Filter,
  Building2, FileText, MoreHorizontal,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { cn }                      from "@/lib/utils"
import { getFinancialDashboard }   from "@/app/actions/finance"
import type {
  FinanceDashboardResult, MethodBreakdown, TopCustomer,
} from "@/app/actions/finance"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerOption { id: string; name: string }

interface Props {
  initialData:     FinanceDashboardResult
  customers:       CustomerOption[]
  defaultDateFrom: string
  defaultDateTo:   string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; badgeCls: string }> = {
  CASH:         { label: "Efectivo",          icon: Banknote,        color: "#10b981", badgeCls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-700/50" },
  TRANSFER:     { label: "Transferencia",     icon: ArrowRightLeft,  color: "#3b82f6", badgeCls: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-700/50" },
  BANK_DEPOSIT: { label: "Depósito bancario", icon: Building2,       color: "#8b5cf6", badgeCls: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-700/50" },
  CHECK:        { label: "Cheque",            icon: FileText,        color: "#f59e0b", badgeCls: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-700/50" },
  OTHER:        { label: "Otro",              icon: MoreHorizontal,  color: "#94a3b8", badgeCls: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600" },
}

const AVATAR_PALETTE = ["bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500","bg-pink-500","bg-indigo-500","bg-emerald-500","bg-rose-500"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} gal`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
function avatarColor(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}
function firstDayOfMonth(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10)
}
function lastDayOfMonth(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toISOString().slice(0, 10)
}
function mondayOfCurrentWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function getPresets(): { label: string; from: string; to: string }[] {
  const today = todayISO()
  return [
    { label: "Hoy",           from: today,              to: today },
    { label: "Esta semana",   from: mondayOfCurrentWeek(), to: today },
    { label: "Este mes",      from: firstDayOfMonth(0), to: today },
    { label: "Mes pasado",    from: firstDayOfMonth(-1), to: lastDayOfMonth(-1) },
    { label: "Últimos 30d",   from: addDays(today, -29), to: today },
  ]
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sub, highlight, alert }: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: string; highlight?: boolean; alert?: boolean
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex items-center gap-4",
      highlight ? "bg-[#1a3fa0] border-blue-700"
        : alert  ? "bg-white dark:bg-slate-900/80 border-red-200 dark:border-red-800/50"
        :           "bg-white dark:bg-slate-900/80 border-slate-100 dark:border-slate-700/50",
    )} style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
          highlight ? "text-blue-200" : "text-slate-500 dark:text-slate-400")}>{label}</p>
        <p className={cn("text-xl font-bold tracking-tight mt-0.5",
          highlight ? "text-white" : alert ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100")}>{value}</p>
        {sub && <p className={cn("text-[11px] mt-0.5",
          highlight ? "text-blue-200" : "text-slate-400 dark:text-slate-500")}>{sub}</p>}
      </div>
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CONFIG[method] ?? METHOD_CONFIG.OTHER
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.badgeCls)}>
      <Icon className="w-3 h-3 shrink-0" />
      {cfg.label}
    </span>
  )
}

function MethodBar({ item, max }: { item: MethodBreakdown; max: number }) {
  const cfg = METHOD_CONFIG[item.method] ?? METHOD_CONFIG.OTHER
  const widthPct = max > 0 ? (item.amount / max) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{cfg.label}</span>
        <div className="text-right shrink-0">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtRD(item.amount)}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">{item.pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${widthPct}%`, backgroundColor: cfg.color }}
        />
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.count} pago{item.count !== 1 ? "s" : ""}</p>
    </div>
  )
}

function TopRow({ rank, item, valueLabel }: { rank: number; item: TopCustomer; valueLabel: string }) {
  const color = avatarColor(item.customerName)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-6 h-6 flex items-center justify-center">
        <span className={cn("text-xs font-bold", rank === 1 ? "text-amber-500" : "text-slate-400 dark:text-slate-500")}>
          #{rank}
        </span>
      </div>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", color)}>
        {item.customerName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.customerName}</p>
        {item.count > 0 && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.count} {valueLabel}</p>
        )}
      </div>
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtRD(item.amount)}</span>
    </div>
  )
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-bold">{fmtRD(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden",
      className,
    )} style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
        <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FinanceClient({
  initialData, customers, defaultDateFrom, defaultDateTo,
}: Props) {
  const [dateFrom,      setDateFrom]      = useState(defaultDateFrom)
  const [dateTo,        setDateTo]        = useState(defaultDateTo)
  const [custId,        setCustId]        = useState("")
  const [method,        setMethod]        = useState("")
  const [data,          setData]          = useState<FinanceDashboardResult>(initialData)
  const [isPending,     startTransition]  = useTransition()
  const [filtersChanged, setFiltersChanged] = useState(false)

  const presets = getPresets()

  function applyFilters(from: string, to: string, cid: string, pm: string) {
    startTransition(async () => {
      const result = await getFinancialDashboard(from, to, cid || undefined, pm || undefined)
      setData(result)
      setFiltersChanged(false)
    })
  }

  function selectPreset(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
    applyFilters(from, to, custId, method)
  }

  function handleDateChange(field: "from" | "to", val: string) {
    if (field === "from") setDateFrom(val); else setDateTo(val)
    setFiltersChanged(true)
  }
  function handleCustChange(val: string) { setCustId(val); setFiltersChanged(true) }
  function handleMethodChange(val: string) { setMethod(val); setFiltersChanged(true) }

  // ── Export PDF ──────────────────────────────────────────────────────────────

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
    const blue = [26, 63, 160] as [number, number, number]
    const w = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(...blue)
    doc.rect(0, 0, w, 28, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("PANEL FINANCIERO", 14, 13)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Período: ${data.periodLabel}`, 14, 21)

    let y = 36

    // KPIs
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Indicadores clave", 14, y)
    y += 5

    const kpiRows = [
      ["Ingresos totales",      fmtRD(data.kpis.totalIncome)],
      ["Transferencias",        fmtRD(data.kpis.totalTransfers)],
      ["Efectivo",              fmtRD(data.kpis.totalCash)],
      ["Total por cobrar",      fmtRD(data.kpis.totalPending)],
      ["Facturas emitidas",     String(data.kpis.invoicesCount)],
      ["Galones vendidos",      fmtGal(data.kpis.gallonsSold)],
      ["Clientes atendidos",    String(data.kpis.customersServed)],
    ]
    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: kpiRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    // By method
    if (data.byMethod.length > 0) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Ingresos por método de pago", 14, y)
      y += 5
      autoTable(doc, {
        startY: y,
        head: [["Método", "Monto", "Pagos", "%"]],
        body: data.byMethod.map(m => [m.label, fmtRD(m.amount), String(m.count), `${m.pct.toFixed(1)}%`]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }

    // Receivables
    if (data.receivables.length > 0) {
      if (y > 220) { doc.addPage(); y = 18 }
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Cuentas por cobrar", 14, y)
      y += 5
      autoTable(doc, {
        startY: y,
        head: [["Cliente", "Balance", "Último pago", "Días"]],
        body: data.receivables.map(r => [
          r.customerName,
          fmtRD(r.balance),
          r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : "—",
          r.daysSinceLastPayment !== null ? String(r.daysSinceLastPayment) : "—",
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }

    // Recent payments
    if (data.recentPayments.length > 0) {
      if (y > 200) { doc.addPage(); y = 18 }
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Últimos pagos", 14, y)
      y += 5
      autoTable(doc, {
        startY: y,
        head: [["#", "Cliente", "Método", "Referencia", "Monto", "Fecha"]],
        body: data.recentPayments.slice(0, 20).map(p => [
          p.paymentNumber,
          p.customerName,
          (METHOD_CONFIG[p.method] ?? METHOD_CONFIG.OTHER).label,
          p.reference ?? "—",
          fmtRD(p.amount),
          fmtDate(p.paymentDate),
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
        columnStyles: { 4: { halign: "right" } },
      })
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(150, 150, 150)
      doc.text(`FuelOps DR — Panel Financiero — Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8)
    }

    doc.save(`finanzas_${dateFrom}_${dateTo}.pdf`)
  }

  // ── Export Excel ────────────────────────────────────────────────────────────

  async function exportExcel() {
    const XLSX = await import("xlsx")

    const wb = XLSX.utils.book_new()

    // Resumen
    const resumenData = [
      ["PANEL FINANCIERO"],
      [`Período: ${data.periodLabel}`],
      [],
      ["Indicadores clave", ""],
      ["Ingresos totales",    data.kpis.totalIncome],
      ["Transferencias",      data.kpis.totalTransfers],
      ["Efectivo",            data.kpis.totalCash],
      ["Total por cobrar",    data.kpis.totalPending],
      ["Facturas emitidas",   data.kpis.invoicesCount],
      ["Galones vendidos",    data.kpis.gallonsSold],
      ["Clientes atendidos",  data.kpis.customersServed],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenData), "Resumen")

    // Por método
    if (data.byMethod.length > 0) {
      const methodData = [
        ["Método", "Monto (RD$)", "Pagos", "Porcentaje"],
        ...data.byMethod.map(m => [m.label, m.amount, m.count, `${m.pct.toFixed(1)}%`]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(methodData), "Por Método")
    }

    // Flujo diario
    const flowData = [
      ["Fecha", "Total (RD$)", "Efectivo (RD$)", "Transferencias (RD$)"],
      ...data.dailyFlow.map(d => [d.dateISO, d.income, d.cash, d.nonCash]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flowData), "Flujo Diario")

    // Cuentas por cobrar
    if (data.receivables.length > 0) {
      const recData = [
        ["Cliente", "Balance (RD$)", "Último pago", "Días sin pago"],
        ...data.receivables.map(r => [
          r.customerName, r.balance,
          r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : "—",
          r.daysSinceLastPayment ?? "—",
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recData), "Por Cobrar")
    }

    // Últimos pagos
    if (data.recentPayments.length > 0) {
      const pymtData = [
        ["#", "Cliente", "Método", "Referencia", "Notas", "Monto (RD$)", "Fecha"],
        ...data.recentPayments.map(p => [
          p.paymentNumber, p.customerName,
          (METHOD_CONFIG[p.method] ?? METHOD_CONFIG.OTHER).label,
          p.reference ?? "", p.notes ?? "",
          p.amount, fmtDatetime(p.paymentDate),
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pymtData), "Últimos Pagos")
    }

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `finanzas_${dateFrom}_${dateTo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const maxMethodAmount = data.byMethod[0]?.amount ?? 1

  // For recharts: only show every Nth label when many days
  const tickInterval = data.dailyFlow.length > 31 ? Math.ceil(data.dailyFlow.length / 15) - 1 : 0

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div
        className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Panel Financiero
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.periodLabel} · Solo administradores
            </p>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1a3fa0] hover:bg-[#163490] transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Período</span>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => selectPreset(p.from, p.to)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  dateFrom === p.from && dateTo === p.to
                    ? "bg-[#1a3fa0] text-white border-[#1a3fa0] shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date inputs + dropdowns */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Desde</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => handleDateChange("from", e.target.value)}
                    className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="mt-4 text-slate-400">—</div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Hasta</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => handleDateChange("to", e.target.value)}
                    className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente</label>
              <div className="relative">
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={custId}
                  onChange={e => handleCustChange(e.target.value)}
                  className="pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer"
                >
                  <option value="">Todos los clientes</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Método</label>
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={method}
                  onChange={e => handleMethodChange(e.target.value)}
                  className="pl-8 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer"
                >
                  <option value="">Todos los métodos</option>
                  {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {filtersChanged && (
              <button
                onClick={() => applyFilters(dateFrom, dateTo, custId, method)}
                disabled={isPending}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-60"
              >
                {isPending ? "Cargando…" : "Aplicar filtros"}
              </button>
            )}

            {isPending && !filtersChanged && (
              <div className="text-xs text-slate-400 animate-pulse">Actualizando…</div>
            )}
          </div>
        </div>
      </div>

      {/* ══ CONTENT ══════════════════════════════════════════════════════════ */}
      <div className={cn("flex-1 overflow-y-auto p-6 space-y-6", isPending && "opacity-60 pointer-events-none")}>

        {/* ── KPI grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={TrendingUp}  iconBg="bg-blue-600" iconColor="text-white"
            label="Ingresos totales" value={fmtRD(data.kpis.totalIncome)}
            sub={`${data.recentPayments.length} pagos`}
            highlight
          />
          <KpiCard
            icon={ArrowRightLeft} iconBg="bg-blue-100 dark:bg-blue-900/40" iconColor="text-blue-600 dark:text-blue-300"
            label="Transferencias" value={fmtRD(data.kpis.totalTransfers)}
          />
          <KpiCard
            icon={Banknote} iconBg="bg-emerald-100 dark:bg-emerald-900/40" iconColor="text-emerald-600 dark:text-emerald-300"
            label="Efectivo" value={fmtRD(data.kpis.totalCash)}
          />
          <KpiCard
            icon={Wallet} iconBg="bg-red-100 dark:bg-red-900/40" iconColor="text-red-500 dark:text-red-300"
            label="Por cobrar" value={fmtRD(data.kpis.totalPending)}
            sub={`${data.receivables.length} clientes`}
            alert
          />
          <KpiCard
            icon={Receipt} iconBg="bg-violet-100 dark:bg-violet-900/40" iconColor="text-violet-600 dark:text-violet-300"
            label="Facturas emitidas" value={String(data.kpis.invoicesCount)}
          />
          <KpiCard
            icon={Droplets} iconBg="bg-cyan-100 dark:bg-cyan-900/40" iconColor="text-cyan-600 dark:text-cyan-300"
            label="Galones vendidos" value={fmtGal(data.kpis.gallonsSold)}
          />
          <KpiCard
            icon={Users} iconBg="bg-orange-100 dark:bg-orange-900/40" iconColor="text-orange-600 dark:text-orange-300"
            label="Clientes atendidos" value={String(data.kpis.customersServed)}
          />
        </div>

        {/* ── Charts row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Daily cash flow chart */}
          <SectionCard title="Flujo de caja diario" icon={BarChart3} className="lg:col-span-2">
            {data.dailyFlow.every(d => d.income === 0) ? (
              <div className="h-[260px] flex flex-col items-center justify-center gap-2">
                <BarChart3 className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Sin ingresos en este período</p>
              </div>
            ) : (
              <div className="p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.dailyFlow} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={8}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      interval={tickInterval}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      width={42}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(v: string) => <span style={{ color: "#94a3b8" }}>{v}</span>}
                    />
                    <Bar dataKey="cash"    name="Efectivo"        fill="#10b981" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="nonCash" name="Transferencias"  fill="#3b82f6" radius={[3,3,0,0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          {/* Method breakdown */}
          <SectionCard title="Por método de pago" icon={CreditCard}>
            {data.byMethod.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center gap-2">
                <CreditCard className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Sin pagos en este período</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {data.byMethod.map(item => (
                  <MethodBar key={item.method} item={item} max={maxMethodAmount} />
                ))}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Total</span>
                    <span className="text-slate-900 dark:text-slate-100 text-sm">{fmtRD(data.kpis.totalIncome)}</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Middle row: Receivables + Top Clientes ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cuentas por cobrar */}
          <SectionCard title="Cuentas por cobrar" icon={AlertCircle}>
            {data.receivables.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <AlertCircle className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Ningún cliente con saldo pendiente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                      <th className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 pl-5 text-left">Cliente</th>
                      <th className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 text-right pr-4">Balance</th>
                      <th className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 text-right pr-5">Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {data.receivables.map(r => (
                      <tr key={r.customerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="pl-5 pr-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(r.customerName))}>
                              {r.customerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate max-w-[140px]">{r.customerName}</p>
                              {r.lastPaymentDate && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">Últ. pago: {fmtDate(r.lastPaymentDate)}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                          {fmtRD(r.balance)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {r.daysSinceLastPayment !== null ? (
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                              r.daysSinceLastPayment > 30
                                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                                : r.daysSinceLastPayment > 14
                                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                            )}>
                              {r.daysSinceLastPayment}d
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Top clientes */}
          <SectionCard title="Top clientes" icon={ShoppingBag}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Top por compras */}
              <div className="p-5">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Por compras (suministros)</p>
                {data.topByPurchase.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Sin datos</p>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {data.topByPurchase.map((c, i) => (
                      <TopRow key={c.customerId} rank={i + 1} item={c} valueLabel="suministros" />
                    ))}
                  </div>
                )}
              </div>
              {/* Top por pagos */}
              <div className="p-5">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Por pagos recibidos</p>
                {data.topByPayment.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Sin datos</p>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {data.topByPayment.map((c, i) => (
                      <TopRow key={c.customerId} rank={i + 1} item={c} valueLabel="pagos" />
                    ))}
                  </div>
                )}
              </div>
              {/* Top deudores */}
              <div className="p-5">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Mayor deuda pendiente</p>
                {data.topByDebt.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Sin deudas pendientes</p>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {data.topByDebt.map((c, i) => (
                      <div key={c.customerId} className="flex items-center gap-3 py-2.5">
                        <span className={cn("text-xs font-bold w-6 text-center", i === 0 ? "text-red-500" : "text-slate-400 dark:text-slate-500")}>#{i + 1}</span>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.customerName))}>
                          {c.customerName.charAt(0).toUpperCase()}
                        </div>
                        <p className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.customerName}</p>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400 shrink-0">{fmtRD(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Últimos pagos ─────────────────────────────────────────────── */}
        <SectionCard title="Últimos pagos" icon={Receipt}>
          {data.recentPayments.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <Receipt className="w-10 h-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400 dark:text-slate-500">Sin pagos registrados en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                    {["#", "Fecha", "Cliente", "Método", "Referencia", "Notas", "Monto"].map((h, i) => (
                      <th key={h} className={cn(
                        "text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3.5",
                        i === 0 ? "pl-5 text-left" : i === 6 ? "pr-5 text-right" : "px-4 text-left",
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {data.recentPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="pl-5 pr-4 py-3.5">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          {p.paymentNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {fmtDatetime(p.paymentDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(p.customerName))}>
                            {p.customerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">{p.customerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <MethodBadge method={p.method} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[100px]">
                        {p.reference ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[120px]">
                        {p.notes ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="pr-5 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {fmtRD(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
