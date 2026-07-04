"use client"

import { useState, useTransition } from "react"
import {
  TrendingUp, Banknote, ArrowRightLeft, Wallet, Receipt,
  Droplets, Users, BarChart3, FileDown, ShoppingBag, CreditCard,
  AlertCircle, ChevronDown, Calendar, Filter,
  Building2, FileText, MoreHorizontal, ChevronLeft, Star,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { cn }                    from "@/lib/utils"
import { getFinancialDashboard } from "@/app/actions/finance"
import type {
  FinanceDashboardResult, MethodBreakdown, TopCustomer, BankSummary,
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

// Bank brand colors
const BANK_COLORS: Record<string, string> = {
  "BanReservas":          "#1d4ed8",
  "Banco Popular":        "#dc2626",
  "BHD León":             "#059669",
  "Scotiabank":           "#ea580c",
  "Banistmo":             "#7c3aed",
  "López de Haro":        "#0891b2",
  "Promerica":            "#4f46e5",
  "Citibank":             "#0369a1",
  "Vimenca":              "#be185d",
  "JMMB":                 "#92400e",
  "Altas Cumbres":        "#065f46",
  "Banco Santa Cruz":     "#1e40af",
  "Efectivo":             "#16a34a",
  "Banco no identificado":"#64748b",
}

function bankColor(name: string) {
  return BANK_COLORS[name] ?? "#64748b"
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
  const d = new Date(); const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10)
}

function getPresets() {
  const today = todayISO()
  return [
    { label: "Hoy",          from: today,               to: today },
    { label: "Esta semana",  from: mondayOfCurrentWeek(), to: today },
    { label: "Este mes",     from: firstDayOfMonth(0),  to: today },
    { label: "Mes pasado",   from: firstDayOfMonth(-1), to: lastDayOfMonth(-1) },
    { label: "Últimos 30d",  from: addDays(today, -29), to: today },
  ]
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
      <Icon className="w-3 h-3 shrink-0" />{cfg.label}
    </span>
  )
}

function MethodBar({ item, max }: { item: MethodBreakdown; max: number }) {
  const cfg = METHOD_CONFIG[item.method] ?? METHOD_CONFIG.OTHER
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
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${max > 0 ? (item.amount / max) * 100 : 0}%`, backgroundColor: cfg.color }} />
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.count} pago{item.count !== 1 ? "s" : ""}</p>
    </div>
  )
}

function TopRow({ rank, item, valueLabel }: { rank: number; item: TopCustomer; valueLabel: string }) {
  const color = avatarColor(item.customerName)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={cn("text-xs font-bold w-6 text-center", rank === 1 ? "text-amber-500" : "text-slate-400 dark:text-slate-500")}>#{rank}</span>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", color)}>
        {item.customerName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.customerName}</p>
        {item.count > 0 && <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.count} {valueLabel}</p>}
      </div>
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtRD(item.amount)}</span>
    </div>
  )
}

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

function SectionCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden", className)}
      style={{ boxShadow: "var(--shadow-card)" }}>
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

// ─── Bank card ────────────────────────────────────────────────────────────────

function BankCard({ bank, total, onClick }: { bank: BankSummary; total: number; onClick: () => void }) {
  const color = bankColor(bank.bankName)
  const pct   = total > 0 ? (bank.totalAmount / total) * 100 : 0

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Bank name + icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ backgroundColor: color }}>
          {bank.bankName === "Efectivo" ? <Banknote className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {bank.bankName}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{bank.paymentCount} pago{bank.paymentCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Total */}
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{fmtRD(bank.totalAmount)}</p>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{pct.toFixed(1)}% del total</p>

      {/* Clients preview */}
      {bank.customers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Clientes</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {bank.customers.slice(0, 2).join(" · ")}
            {bank.customers.length > 2 && <span className="text-slate-400"> +{bank.customers.length - 2}</span>}
          </p>
        </div>
      )}
    </button>
  )
}

// ─── Bank detail view ─────────────────────────────────────────────────────────

function BankDetail({ bank, dateFrom, dateTo, onBack }: {
  bank: BankSummary; dateFrom: string; dateTo: string; onBack: () => void
}) {
  const color     = bankColor(bank.bankName)
  const tickInterval = bank.dailyFlow.length > 31 ? Math.ceil(bank.dailyFlow.length / 15) - 1 : 0
  const hasFlow   = bank.dailyFlow.some(d => d.amount > 0)

  async function exportBankPDF() {
    const { default: jsPDF }      = await import("jspdf")
    const { default: autoTable }  = await import("jspdf-autotable")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
    const w = doc.internal.pageSize.getWidth()

    doc.setFillColor(26, 63, 160)
    doc.rect(0, 0, w, 28, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14); doc.setFont("helvetica", "bold")
    doc.text(`BANCO: ${bank.bankName.toUpperCase()}`, 14, 13)
    doc.setFontSize(9); doc.setFont("helvetica", "normal")
    doc.text(`Período: ${dateFrom} al ${dateTo}`, 14, 21)

    let y = 36
    const blue = [26, 63, 160] as [number, number, number]
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total recibido",    fmtRD(bank.totalAmount)],
        ["Cantidad de pagos", String(bank.paymentCount)],
        ["Promedio por pago", fmtRD(bank.avgPayment)],
        ["Cliente principal", bank.topCustomer?.name ?? "—"],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    autoTable(doc, {
      startY: y,
      head: [["#", "Fecha", "Cliente", "Método", "Referencia", "Notas", "Monto"]],
      body: bank.payments.map(p => [
        p.paymentNumber,
        fmtDatetime(p.paymentDate),
        p.customerName,
        (METHOD_CONFIG[p.method] ?? METHOD_CONFIG.OTHER).label,
        p.reference ?? "—",
        p.notes ?? "—",
        fmtRD(p.amount),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      columnStyles: { 6: { halign: "right" } },
    })

    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150)
      doc.text(`FuelOps DR — ${bank.bankName} — Pág. ${i}/${pages}`, 14, doc.internal.pageSize.getHeight() - 8)
    }
    doc.save(`banco_${bank.bankName.replace(/\s+/g, "_")}_${dateFrom}_${dateTo}.pdf`)
  }

  async function exportBankExcel() {
    const XLSX = await import("xlsx")
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`BANCO: ${bank.bankName}`],
      [`Período: ${dateFrom} al ${dateTo}`],
      [],
      ["Total recibido",    bank.totalAmount],
      ["Cantidad de pagos", bank.paymentCount],
      ["Promedio por pago", bank.avgPayment],
      ["Cliente principal", bank.topCustomer?.name ?? "—"],
    ]), "Resumen")

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["#", "Fecha", "Cliente", "Método", "Referencia", "Notas", "Monto (RD$)"],
      ...bank.payments.map(p => [
        p.paymentNumber, fmtDatetime(p.paymentDate), p.customerName,
        (METHOD_CONFIG[p.method] ?? METHOD_CONFIG.OTHER).label,
        p.reference ?? "", p.notes ?? "", p.amount,
      ]),
    ]), "Pagos")

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Fecha", "Monto (RD$)"],
      ...bank.dailyFlow.map(d => [d.dateISO, d.amount]),
    ]), "Flujo Diario")

    const buf  = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `banco_${bank.bankName.replace(/\s+/g, "_")}_${dateFrom}_${dateTo}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Todos los bancos
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: color }}>
              {bank.bankName === "Efectivo" ? <Banknote className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">{bank.bankName}</h2>
              <p className="text-xs text-slate-400">{bank.paymentCount} pago{bank.paymentCount !== 1 ? "s" : ""} · {bank.customers.length} cliente{bank.customers.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportBankPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[#1a3fa0] hover:bg-[#163490] transition-colors">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportBankExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-700/50 transition-colors">
            <FileDown className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} iconBg="bg-blue-600" iconColor="text-white"
          label="Total recibido" value={fmtRD(bank.totalAmount)} highlight />
        <KpiCard icon={Receipt} iconBg="bg-slate-100 dark:bg-slate-800" iconColor="text-slate-600 dark:text-slate-300"
          label="Cantidad de pagos" value={String(bank.paymentCount)} />
        <KpiCard icon={BarChart3} iconBg="bg-violet-100 dark:bg-violet-900/40" iconColor="text-violet-600 dark:text-violet-300"
          label="Promedio por pago" value={fmtRD(bank.avgPayment)} />
        <KpiCard icon={Star} iconBg="bg-amber-100 dark:bg-amber-900/40" iconColor="text-amber-600 dark:text-amber-300"
          label="Cliente principal"
          value={bank.topCustomer?.name ?? "—"}
          sub={bank.topCustomer ? fmtRD(bank.topCustomer.amount) : undefined}
        />
      </div>

      {/* Daily flow chart */}
      <SectionCard title={`Flujo diario — ${bank.bankName}`} icon={BarChart3}>
        {!hasFlow ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-2">
            <BarChart3 className="w-10 h-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin ingresos en este período</p>
          </div>
        ) : (
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bank.dailyFlow} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={10}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Bar dataKey="amount" name="Ingresado" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Clients list */}
      {bank.customers.length > 0 && (
        <SectionCard title="Clientes que pagaron por este banco" icon={Users}>
          <div className="p-5 flex flex-wrap gap-2">
            {bank.customers.map(name => (
              <div key={name} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2">
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0", avatarColor(name))}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Payments table */}
      <SectionCard title="Pagos detallados" icon={Receipt}>
        {bank.payments.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2">
            <Receipt className="w-10 h-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin pagos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                  {["#", "Fecha / Hora", "Cliente", "Método", "Referencia", "Notas", "Monto"].map((h, i) => (
                    <th key={h} className={cn(
                      "text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3.5",
                      i === 0 ? "pl-5 pr-3 text-left" : i === 6 ? "pr-5 text-right" : "px-4 text-left",
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {bank.payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="pl-5 pr-3 py-3.5">
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
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[130px]">{p.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><MethodBadge method={p.method} /></td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                      {p.reference
                        ? <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{p.reference}</span>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>}
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
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <td colSpan={6} className="pl-5 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Total ({bank.paymentCount} pagos)
                  </td>
                  <td className="pr-5 py-3 text-right text-base font-bold text-slate-900 dark:text-slate-100">
                    {fmtRD(bank.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Bancos grid view ─────────────────────────────────────────────────────────

function BancosView({ data, dateFrom, dateTo }: {
  data: FinanceDashboardResult; dateFrom: string; dateTo: string
}) {
  const [selectedBank, setSelectedBank] = useState<string | null>(null)

  const bank = selectedBank ? data.byBank.find(b => b.bankName === selectedBank) : null

  if (bank) {
    return (
      <BankDetail
        bank={bank}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onBack={() => setSelectedBank(null)}
      />
    )
  }

  const total = data.byBank.reduce((s, b) => s + b.totalAmount, 0)

  if (data.byBank.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Building2 className="w-14 h-14 text-slate-200 dark:text-slate-700" />
        <p className="font-semibold text-slate-500 dark:text-slate-400">Sin pagos en este período</p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Ajusta el rango de fechas o los filtros</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100">
            {data.byBank.length} banco{data.byBank.length !== 1 ? "s" : ""} detectado{data.byBank.length !== 1 ? "s" : ""}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Haz clic en un banco para ver el detalle completo
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total período</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtRD(total)}</p>
        </div>
      </div>

      {/* Bank cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.byBank.map(b => (
          <BankCard
            key={b.bankName}
            bank={b}
            total={total}
            onClick={() => setSelectedBank(b.bankName)}
          />
        ))}
      </div>

      {/* Summary table */}
      <SectionCard title="Resumen por banco" icon={Building2}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                {["Banco", "Total recibido", "Pagos", "Promedio", "Clientes", "%"].map((h, i) => (
                  <th key={h} className={cn(
                    "text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3.5",
                    i === 0 ? "pl-5 text-left" : "px-4 text-right",
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {data.byBank.map(b => {
                const pct = total > 0 ? (b.totalAmount / total) * 100 : 0
                const color = bankColor(b.bankName)
                return (
                  <tr key={b.bankName}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedBank(b.bankName)}>
                    <td className="pl-5 pr-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: color }}>
                          {b.bankName === "Efectivo" ? <Banknote className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{b.bankName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">{fmtRD(b.totalAmount)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-300">{b.paymentCount}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-300">{fmtRD(b.avgPayment)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-300">{b.customers.length}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <td className="pl-5 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Total</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{fmtRD(total)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                  {data.byBank.reduce((s, b) => s + b.paymentCount, 0)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Resumen view ─────────────────────────────────────────────────────────────

function ResumenView({ data, dateFrom, dateTo }: { data: FinanceDashboardResult; dateFrom: string; dateTo: string }) {
  const maxMethodAmount  = data.byMethod[0]?.amount ?? 1
  const tickInterval     = data.dailyFlow.length > 31 ? Math.ceil(data.dailyFlow.length / 15) - 1 : 0

  async function exportPDF() {
    const { default: jsPDF }     = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
    const blue = [26, 63, 160] as [number, number, number]
    const w = doc.internal.pageSize.getWidth()
    doc.setFillColor(...blue); doc.rect(0, 0, w, 28, "F")
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold")
    doc.text("PANEL FINANCIERO", 14, 13)
    doc.setFontSize(9); doc.setFont("helvetica", "normal")
    doc.text(`Período: ${data.periodLabel}`, 14, 21)
    let y = 36
    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: [
        ["Ingresos totales",    fmtRD(data.kpis.totalIncome)],
        ["Transferencias",      fmtRD(data.kpis.totalTransfers)],
        ["Efectivo",            fmtRD(data.kpis.totalCash)],
        ["Total por cobrar",    fmtRD(data.kpis.totalPending)],
        ["Facturas emitidas",   String(data.kpis.invoicesCount)],
        ["Galones vendidos",    fmtGal(data.kpis.gallonsSold)],
        ["Clientes atendidos",  String(data.kpis.customersServed)],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    if (data.byMethod.length > 0) {
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
    if (data.receivables.length > 0) {
      if (y > 220) { doc.addPage(); y = 18 }
      autoTable(doc, {
        startY: y,
        head: [["Cliente", "Balance", "Último pago", "Días"]],
        body: data.receivables.map(r => [r.customerName, fmtRD(r.balance), r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : "—", r.daysSinceLastPayment !== null ? String(r.daysSinceLastPayment) : "—"]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
    }
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150)
      doc.text(`FuelOps DR — Finanzas — Pág. ${i}/${pages}`, 14, doc.internal.pageSize.getHeight() - 8)
    }
    doc.save(`finanzas_${dateFrom}_${dateTo}.pdf`)
  }

  async function exportExcel() {
    const XLSX = await import("xlsx")
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["PANEL FINANCIERO"], [`Período: ${data.periodLabel}`], [],
      ["Ingresos totales", data.kpis.totalIncome], ["Transferencias", data.kpis.totalTransfers],
      ["Efectivo", data.kpis.totalCash], ["Total por cobrar", data.kpis.totalPending],
      ["Facturas emitidas", data.kpis.invoicesCount], ["Galones vendidos", data.kpis.gallonsSold],
      ["Clientes atendidos", data.kpis.customersServed],
    ]), "Resumen")
    if (data.byMethod.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Método", "Monto (RD$)", "Pagos", "%"],
        ...data.byMethod.map(m => [m.label, m.amount, m.count, `${m.pct.toFixed(1)}%`]),
      ]), "Por Método")
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Fecha", "Total (RD$)", "Efectivo (RD$)", "Transferencias (RD$)"],
      ...data.dailyFlow.map(d => [d.dateISO, d.income, d.cash, d.nonCash]),
    ]), "Flujo Diario")
    if (data.byBank.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Banco", "Total (RD$)", "Pagos", "Promedio (RD$)", "Clientes"],
        ...data.byBank.map(b => [b.bankName, b.totalAmount, b.paymentCount, b.avgPayment, b.customers.length]),
      ]), "Por Banco")
    }
    if (data.receivables.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Cliente", "Balance (RD$)", "Último pago", "Días sin pago"],
        ...data.receivables.map(r => [r.customerName, r.balance, r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : "—", r.daysSinceLastPayment ?? "—"]),
      ]), "Por Cobrar")
    }
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url
    a.download = `finanzas_${dateFrom}_${dateTo}.xlsx`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Export buttons */}
      <div className="flex justify-end gap-2 -mt-2 mb-2">
        <button onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1a3fa0] hover:bg-[#163490] transition-colors shadow-sm">
          <FileDown className="w-4 h-4" /> PDF
        </button>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50 transition-colors">
          <FileDown className="w-4 h-4" /> Excel
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} iconBg="bg-blue-600" iconColor="text-white"
          label="Ingresos totales" value={fmtRD(data.kpis.totalIncome)}
          sub={`${data.recentPayments.length} pagos`} highlight />
        <KpiCard icon={ArrowRightLeft} iconBg="bg-blue-100 dark:bg-blue-900/40" iconColor="text-blue-600 dark:text-blue-300"
          label="Transferencias" value={fmtRD(data.kpis.totalTransfers)} />
        <KpiCard icon={Banknote} iconBg="bg-emerald-100 dark:bg-emerald-900/40" iconColor="text-emerald-600 dark:text-emerald-300"
          label="Efectivo" value={fmtRD(data.kpis.totalCash)} />
        <KpiCard icon={Wallet} iconBg="bg-red-100 dark:bg-red-900/40" iconColor="text-red-500 dark:text-red-300"
          label="Por cobrar" value={fmtRD(data.kpis.totalPending)}
          sub={`${data.receivables.length} clientes`} alert />
        <KpiCard icon={Receipt} iconBg="bg-violet-100 dark:bg-violet-900/40" iconColor="text-violet-600 dark:text-violet-300"
          label="Facturas emitidas" value={String(data.kpis.invoicesCount)} />
        <KpiCard icon={Droplets} iconBg="bg-cyan-100 dark:bg-cyan-900/40" iconColor="text-cyan-600 dark:text-cyan-300"
          label="Galones vendidos" value={fmtGal(data.kpis.gallonsSold)} />
        <KpiCard icon={Users} iconBg="bg-orange-100 dark:bg-orange-900/40" iconColor="text-orange-600 dark:text-orange-300"
          label="Clientes atendidos" value={String(data.kpis.customersServed)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(v: string) => <span style={{ color: "#94a3b8" }}>{v}</span>} />
                  <Bar dataKey="cash"    name="Efectivo"       fill="#10b981" radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="nonCash" name="Transferencias" fill="#3b82f6" radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Por método de pago" icon={CreditCard}>
          {data.byMethod.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center gap-2">
              <CreditCard className="w-10 h-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400 dark:text-slate-500">Sin pagos en este período</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {data.byMethod.map(item => <MethodBar key={item.method} item={item} max={maxMethodAmount} />)}
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

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            {r.lastPaymentDate && <p className="text-[11px] text-slate-400 dark:text-slate-500">Últ: {fmtDate(r.lastPaymentDate)}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 whitespace-nowrap">{fmtRD(r.balance)}</td>
                      <td className="px-5 py-3 text-right">
                        {r.daysSinceLastPayment !== null ? (
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                            r.daysSinceLastPayment > 30 ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                              : r.daysSinceLastPayment > 14 ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>
                            {r.daysSinceLastPayment}d
                          </span>
                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Top clientes" icon={ShoppingBag}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-5">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Por compras (suministros)</p>
              {data.topByPurchase.length === 0 ? <p className="text-sm text-slate-400 py-2">Sin datos</p> : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {data.topByPurchase.map((c, i) => <TopRow key={c.customerId} rank={i + 1} item={c} valueLabel="suministros" />)}
                </div>
              )}
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Por pagos recibidos</p>
              {data.topByPayment.length === 0 ? <p className="text-sm text-slate-400 py-2">Sin datos</p> : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {data.topByPayment.map((c, i) => <TopRow key={c.customerId} rank={i + 1} item={c} valueLabel="pagos" />)}
                </div>
              )}
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Mayor deuda pendiente</p>
              {data.topByDebt.length === 0 ? <p className="text-sm text-slate-400 py-2">Sin deudas</p> : (
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

      {/* Recent payments */}
      <SectionCard title="Últimos pagos" icon={Receipt}>
        {data.recentPayments.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <Receipt className="w-10 h-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin pagos en este período</p>
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
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">{fmtDatetime(p.paymentDate)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(p.customerName))}>
                          {p.customerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">{p.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><MethodBadge method={p.method} /></td>
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
    </>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FinanceClient({ initialData, customers, defaultDateFrom, defaultDateTo }: Props) {
  const [dateFrom,       setDateFrom]       = useState(defaultDateFrom)
  const [dateTo,         setDateTo]         = useState(defaultDateTo)
  const [custId,         setCustId]         = useState("")
  const [method,         setMethod]         = useState("")
  const [data,           setData]           = useState<FinanceDashboardResult>(initialData)
  const [panelView,      setPanelView]      = useState<"resumen" | "bancos">("resumen")
  const [isPending,      startTransition]   = useTransition()
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
    setDateFrom(from); setDateTo(to)
    applyFilters(from, to, custId, method)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-4 sm:px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Panel Financiero</h1>
            <p className="text-xs text-slate-400 mt-0.5">{data.periodLabel} · Solo administradores</p>
          </div>
          {/* Tab toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5">
            <button onClick={() => setPanelView("resumen")}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                panelView === "resumen"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
              <BarChart3 className="w-4 h-4" /> Resumen
            </button>
            <button onClick={() => setPanelView("bancos")}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                panelView === "bancos"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
              <Building2 className="w-4 h-4" /> Bancos
              {data.byBank.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {data.byBank.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Período</span>
            {presets.map(p => (
              <button key={p.label} onClick={() => selectPreset(p.from, p.to)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  dateFrom === p.from && dateTo === p.to
                    ? "bg-[#1a3fa0] text-white border-[#1a3fa0] shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600")}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Desde</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="date" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setFiltersChanged(true) }}
                    className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
              <div className="mt-4 text-slate-400">—</div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Hasta</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="date" value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setFiltersChanged(true) }}
                    className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente</label>
              <div className="relative">
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select value={custId} onChange={e => { setCustId(e.target.value); setFiltersChanged(true) }}
                  className="pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer">
                  <option value="">Todos los clientes</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Método</label>
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select value={method} onChange={e => { setMethod(e.target.value); setFiltersChanged(true) }}
                  className="pl-8 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer">
                  <option value="">Todos los métodos</option>
                  {Object.entries(METHOD_CONFIG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            {filtersChanged && (
              <button onClick={() => applyFilters(dateFrom, dateTo, custId, method)} disabled={isPending}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-60">
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
        {panelView === "resumen" ? (
          <ResumenView data={data} dateFrom={dateFrom} dateTo={dateTo} />
        ) : (
          <BancosView data={data} dateFrom={dateFrom} dateTo={dateTo} />
        )}
      </div>
    </div>
  )
}
