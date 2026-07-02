"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import {
  ChevronRight, Phone, Mail, MapPin, Tag, CreditCard,
  Droplets, FileText, AlertTriangle, DollarSign,
  Calendar, CheckCircle2, XCircle, AlertCircle,
  Truck, Clock, ArrowLeft, Pencil, Hash,
  TrendingUp, Fuel, Receipt,
  Activity,
} from "lucide-react"
import type { TimelineEvent } from "@/app/actions/customer-detail"
import { cn } from "@/lib/utils"
import type { CustomerDetailData } from "@/app/actions/customer-detail"

// ─── Constants ────────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#f59e0b","#10b981","#ef4444","#ec4899","#f97316"]

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:        { label: "Pendiente",      cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PARTIALLY_PAID: { label: "Parcial",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID:           { label: "Pagada",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OVERDUE:        { label: "Vencida",        cls: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED:      { label: "Cancelada",      cls: "bg-slate-50 text-slate-500 border-slate-200" },
}

const PAYMENT_METHODS: Record<string, string> = {
  CASH:         "Efectivo",
  TRANSFER:     "Transferencia",
  BANK_DEPOSIT: "Depósito",
  CHECK:        "Cheque",
  OTHER:        "Otro",
}

const TRUCK_TYPES: Record<string, string> = {
  TRUCK:     "Camión",
  TRAILER:   "Tráiler",
  EQUIPMENT: "Equipo",
  GENERATOR: "Generador",
  OTHER:     "Otro",
}

const AVATAR_PALETTE = [
  "bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500",
  "bg-pink-500","bg-indigo-500","bg-emerald-500","bg-rose-500",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }),
  }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor, label, value, sub, danger,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: string; danger?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4"
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={cn(
          "text-xl font-bold tracking-tight mt-0.5",
          danger ? "text-red-600" : "text-slate-900",
        )}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionCard({ title, children, className }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-100 overflow-hidden",
      className)}
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      {title && (
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, cls: "bg-slate-50 text-slate-500 border-slate-200" }
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", s.cls)}>
      {s.label}
    </span>
  )
}

// ─── Chart: Consumo en el tiempo ─────────────────────────────────────────────

type ChartFilter = "DIA" | "SEMANA" | "MES" | "AÑO"

function ConsumoChart({ supplies }: { supplies: CustomerDetailData["supplies"] }) {
  const [filter, setFilter] = useState<ChartFilter>("MES")

  const data = useMemo(() => {
    const now = new Date()
    const buckets: Record<string, number> = {}

    if (filter === "DIA") {
      for (let h = 23; h >= 0; h--) {
        const d = new Date(now)
        d.setHours(now.getHours() - h, 0, 0, 0)
        buckets[`${String(d.getHours()).padStart(2, "0")}:00`] = 0
      }
      for (const s of supplies) {
        const d    = new Date(s.suppliedAt)
        const diffH = (now.getTime() - d.getTime()) / 3_600_000
        if (diffH <= 24) {
          const key = `${String(d.getHours()).padStart(2, "0")}:00`
          if (key in buckets) buckets[key] += s.gallons
        }
      }
    } else if (filter === "SEMANA") {
      const DAY = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(now); dt.setDate(now.getDate() - d)
        buckets[`${DAY[dt.getDay()]} ${dt.getDate()}`] = 0
      }
      for (const s of supplies) {
        const d     = new Date(s.suppliedAt)
        const diffD = (now.getTime() - d.getTime()) / 86_400_000
        if (diffD <= 7) {
          const key = `${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d.getDay()]} ${d.getDate()}`
          if (key in buckets) buckets[key] += s.gallons
        }
      }
    } else if (filter === "MES") {
      for (let d = 29; d >= 0; d--) {
        const dt = new Date(now); dt.setDate(now.getDate() - d)
        const key = `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`
        buckets[key] = 0
      }
      for (const s of supplies) {
        const d     = new Date(s.suppliedAt)
        const diffD = (now.getTime() - d.getTime()) / 86_400_000
        if (diffD <= 30) {
          const key = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
          if (key in buckets) buckets[key] += s.gallons
        }
      }
    } else {
      const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
      for (let m = 11; m >= 0; m--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - m, 1)
        buckets[`${MES[dt.getMonth()]} ${dt.getFullYear()}`] = 0
      }
      for (const s of supplies) {
        const d   = new Date(s.suppliedAt)
        const key = `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]} ${d.getFullYear()}`
        if (key in buckets) buckets[key] += s.gallons
      }
    }

    return Object.entries(buckets).map(([label, galones]) => ({ label, galones: Math.round(galones * 100) / 100 }))
  }, [supplies, filter])

  const labels: Record<ChartFilter, string> = {
    DIA: "Día", SEMANA: "Semana", MES: "Mes", AÑO: "Año",
  }

  const hasData = data.some(d => d.galones > 0)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(["DIA","SEMANA","MES","AÑO"] as ChartFilter[]).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filter === f
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:bg-slate-100",
            )}>
            {labels[f]}
          </button>
        ))}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false} axisLine={false}
              interval={filter === "MES" ? 4 : 0} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false} axisLine={false}
              tickFormatter={v => `${v}gal`} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v) => [`${Number(v).toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`, "Galones"]}
            />
            <Line type="monotone" dataKey="galones" stroke="#3b82f6"
              strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex flex-col items-center justify-center text-slate-300">
          <Droplets className="w-10 h-10 mb-2" />
          <p className="text-sm font-medium">Sin suministros en este período</p>
        </div>
      )}
    </div>
  )
}

// ─── Chart: Combustible por camión ───────────────────────────────────────────

function TruckDonut({ trucks }: { trucks: CustomerDetailData["trucks"] }) {
  const data = trucks.filter(t => t.gallonsBilled > 0).map((t, i) => ({
    name:    t.name || t.code,
    value:   Math.round(t.gallonsBilled * 100) / 100,
    pct:     t.pctOfTotal,
    color:   DONUT_COLORS[i % DONUT_COLORS.length],
  }))

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-slate-300">
        <Truck className="w-10 h-10 mb-2" />
        <p className="text-sm font-medium">Sin datos por camión</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="40%" cy="50%" innerRadius={55} outerRadius={85}
          dataKey="value" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v) => [`${Number(v).toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`]}
        />
        <Legend
          layout="vertical" align="right" verticalAlign="middle"
          iconType="circle" iconSize={8}
          formatter={(value, entry) => {
            const e = entry as { payload?: { pct?: number } }
            return (
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {value} <span style={{ fontWeight: 700 }}>{e.payload?.pct?.toFixed(1)}%</span>
              </span>
            )
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "resumen" | "suministros" | "facturas" | "pagos" | "camiones" | "timeline"

const TABS: { id: Tab; label: string }[] = [
  { id: "resumen",     label: "Resumen"     },
  { id: "suministros", label: "Suministros" },
  { id: "facturas",    label: "Facturas"    },
  { id: "pagos",       label: "Pagos"       },
  { id: "camiones",    label: "Camiones"    },
  { id: "timeline",    label: "Historial"   },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerDetailClient({ data }: { data: CustomerDetailData }) {
  const [tab, setTab] = useState<Tab>("resumen")

  const avatarBg  = avatarColor(data.name)
  const isActive  = data.status === "ACTIVE"

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ═══════════════════════════════════════════════════════ HEADER */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 font-sans">
          <Link href="/clientes" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Clientes
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 font-medium truncate max-w-[240px]">{data.name}</span>
        </div>

        {/* Customer identity row */}
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0",
            avatarBg,
          )}>
            {initials(data.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.name}</h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-red-50 text-red-600 border-red-100",
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-red-500")} />
                {isActive ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {data.phone && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {data.phone}
                </span>
              )}
              {data.email && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {data.email}
                </span>
              )}
              {data.address && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {data.address}
                </span>
              )}
              {data.rnc && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> RNC: {data.rnc}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0">
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── KPI Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={DollarSign}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            label="Deuda actual"
            value={fmtRD(data.debtActual)}
            sub={data.debtActual > 0 ? "Saldo pendiente" : "Sin deuda"}
            danger={data.debtActual > 0}
          />
          <KpiCard
            icon={Droplets}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            label="Galones pendientes"
            value={fmtGal(data.pendingGallonsComputed)}
            sub="De facturas abiertas"
          />
          <KpiCard
            icon={FileText}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="Facturas pendientes"
            value={data.pendingInvoicesCount.toString()}
            sub="Sin liquidar"
          />
          <KpiCard
            icon={AlertTriangle}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            label="Facturas vencidas"
            value={data.overdueInvoicesCount.toString()}
            sub={data.overdueInvoicesCount > 0 ? "Requieren atención" : "Al día"}
            danger={data.overdueInvoicesCount > 0}
          />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                  tab === t.id
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-500 border-transparent hover:text-slate-700",
                )}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === "resumen"     && <ResumenTab data={data} />}
            {tab === "suministros" && <SuministrosTab data={data} />}
            {tab === "facturas"    && <FacturasTab data={data} />}
            {tab === "pagos"       && <PagosTab data={data} />}
            {tab === "camiones"    && <CamionesTab data={data} />}
            {tab === "timeline"    && <TimelineTab data={data} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Resumen Tab ──────────────────────────────────────────────────────────────

function ConsumptionStatsStrip({ data }: { data: CustomerDetailData }) {
  const stats = [
    {
      icon: TrendingUp,
      label: "Prom. diario (30d)",
      value: data.avgDailyGallons > 0
        ? `${data.avgDailyGallons.toLocaleString("es-DO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} gal`
        : "—",
      color: "text-blue-600",
      bg:    "bg-blue-50",
    },
    {
      icon: Fuel,
      label: "Prom. mensual (90d)",
      value: data.avgMonthlyGallons > 0
        ? `${data.avgMonthlyGallons.toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} gal`
        : "—",
      color: "text-violet-600",
      bg:    "bg-violet-50",
    },
    {
      icon: Activity,
      label: "Total histórico",
      value: data.totalGallonsAllTime > 0
        ? `${data.totalGallonsAllTime.toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} gal`
        : "—",
      color: "text-emerald-600",
      bg:    "bg-emerald-50",
    },
    {
      icon: Calendar,
      label: "Última compra",
      value: data.lastPurchaseDate
        ? new Date(data.lastPurchaseDate).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
        : "—",
      color: "text-amber-600",
      bg:    "bg-amber-50",
    },
  ]
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{label}</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 leading-tight truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ResumenTab({ data }: { data: CustomerDetailData }) {
  return (
    <div className="space-y-5">
      {/* Consumption stats strip */}
      <ConsumptionStatsStrip data={data} />

      {/* Row 1: Datos comerciales + Consumo chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Datos comerciales */}
        <SectionCard title="Datos comerciales">
          <div className="p-5 space-y-3">
            {[
              {
                icon: Tag,
                label: "Precio por galón efectivo",
                value: data.effectivePricePerGallon > 0
                  ? fmtRD(data.effectivePricePerGallon)
                  : "—",
              },
              {
                icon: Tag,
                label: "Tipo de precio",
                value: data.priceType === "FIXED"
                  ? `Fijo (${fmtRD(data.fuelPricePerGallon)}/gal)`
                  : `Descuento ${data.priceDiscount}% sobre base`,
              },
              {
                icon: CreditCard,
                label: "Límite de crédito",
                value: data.creditLimit > 0 ? fmtRD(data.creditLimit) : "Sin límite",
              },
              {
                icon: Clock,
                label: "Días de crédito",
                value: "30 días",
              },
              {
                icon: Calendar,
                label: "Fecha de registro",
                value: fmtDate(data.createdAt),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                </div>
              </div>
            ))}

            {data.notes && (
              <div className="mt-1 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notas</p>
                <p className="text-xs text-slate-600 leading-relaxed">{data.notes}</p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Consumo chart */}
        <SectionCard title="Consumo de combustible en el tiempo">
          <div className="p-5">
            <ConsumoChart supplies={data.supplies} />
          </div>
        </SectionCard>
      </div>

      {/* Row 2: Donut + Camiones table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Donut */}
        <SectionCard title="Combustible facturado por camión">
          <div className="p-5">
            <TruckDonut trucks={data.trucks} />
          </div>
        </SectionCard>

        {/* Trucks table preview */}
        <SectionCard title="Camiones registrados">
          {data.trucks.length === 0 ? (
            <div className="p-5 text-center text-slate-400 text-sm">Sin camiones registrados</div>
          ) : (
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Código","Nombre","Tipo","Estado","Galones"].map((h, i) => (
                    <th key={h} className={cn(
                      "py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                      i === 0 ? "text-left pl-5" :
                      i === 4 ? "text-right pr-5" : "text-left px-3",
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.trucks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="pl-5 py-3 font-bold text-blue-600">{t.code}</td>
                    <td className="px-3 py-3 text-slate-700 font-medium">{t.name}</td>
                    <td className="px-3 py-3 text-slate-500">{TRUCK_TYPES[t.type] ?? t.type}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold",
                        t.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600",
                      )}>
                        {t.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="pr-5 py-3 text-right font-semibold text-slate-700">
                      {fmtGal(t.gallonsBilled)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      {/* Row 3: Últimos suministros + Últimas facturas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title={`Últimos suministros (${data.supplies.length})`}>
          <SuppliesTable supplies={data.supplies.slice(0, 8)} compact />
        </SectionCard>
        <SectionCard title={`Últimos pagos/abonos (${data.payments.length})`}>
          <PaymentsTable payments={data.payments.slice(0, 8)} compact />
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Suministros Tab ──────────────────────────────────────────────────────────

function SuministrosTab({ data }: { data: CustomerDetailData }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-4 font-sans">
        {data.supplies.length} suministros registrados · Total:{" "}
        <span className="font-semibold text-slate-700">
          {fmtGal(data.supplies.reduce((s, x) => s + x.gallons, 0))}
        </span>
      </p>
      <SectionCard>
        <SuppliesTable supplies={data.supplies} />
      </SectionCard>
    </div>
  )
}

function SuppliesTable({
  supplies, compact = false,
}: { supplies: CustomerDetailData["supplies"]; compact?: boolean }) {
  if (supplies.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <Droplets className="w-8 h-8 mx-auto mb-2 text-slate-200" />
        Sin suministros registrados
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-sans">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70">
            {["Fecha","Camión","Galones","Precio/Gal","Total","Tipo","Factura"].map((h, i) => (
              <th key={h} className={cn(
                "py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                i === 0 ? "text-left pl-5" :
                i === 6 ? "text-right pr-5" :
                [2,3,4].includes(i) ? "text-right px-3" : "text-left px-3",
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {supplies.map(s => (
            <tr key={s.id} className="hover:bg-slate-50/40">
              <td className="pl-5 py-3 text-slate-600">{fmtDate(s.suppliedAt)}</td>
              <td className="px-3 py-3 font-medium text-slate-700">
                {s.truckCode
                  ? <span>{s.truckCode} <span className="text-slate-400 font-normal">·</span> {s.truckName}</span>
                  : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-blue-600">{fmtGal(s.gallons)}</td>
              <td className="px-3 py-3 text-right text-slate-600">{fmtRD(s.pricePerGallon)}</td>
              <td className="px-3 py-3 text-right font-bold text-slate-800">{fmtRD(s.total)}</td>
              <td className="px-3 py-3">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-bold",
                  s.paymentType === "CASH"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700",
                )}>
                  {s.paymentType === "CASH" ? "Efectivo" : "Crédito"}
                </span>
              </td>
              <td className="pr-5 py-3 text-right text-slate-500 font-mono text-[10px]">
                {s.invoiceNumber ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Facturas Tab ─────────────────────────────────────────────────────────────

function FacturasTab({ data }: { data: CustomerDetailData }) {
  const [statusFilter, setStatusFilter] = useState("ALL")

  const filtered = statusFilter === "ALL"
    ? data.invoicesAll
    : data.invoicesAll.filter(inv => inv.status === statusFilter)

  const statuses = [
    { id: "ALL",            label: "Todas" },
    { id: "PENDING",        label: "Pendientes" },
    { id: "PARTIALLY_PAID", label: "Parciales" },
    { id: "OVERDUE",        label: "Vencidas" },
    { id: "PAID",           label: "Pagadas" },
  ]

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all",
              statusFilter === s.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300",
            )}>
            {s.label}
            {s.id !== "ALL" && (
              <span className="ml-1.5 opacity-70">
                ({data.invoicesAll.filter(i => i.status === s.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <SectionCard>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            Sin facturas en esta categoría
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Factura","Fecha","Camión","Galones","Precio/Gal","Total","Pagado","Pendiente","Vencimiento","Estado"].map((h, i) => (
                    <th key={h} className={cn(
                      "py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                      i === 0 ? "text-left pl-5" :
                      i === 9 ? "text-center pr-5 px-3" :
                      [3,4,5,6,7].includes(i) ? "text-right px-3" : "text-left px-3",
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => {
                  const overdue = inv.status === "OVERDUE"
                  return (
                    <tr key={inv.id} className={cn(
                      "hover:bg-slate-50/40 transition-colors",
                      overdue && "bg-red-50/30",
                    )}>
                      <td className="pl-5 py-3 font-mono font-bold text-blue-600 text-[11px]">{inv.invoiceNumber}</td>
                      <td className="px-3 py-3 text-slate-600">{fmtDate(inv.issueDate)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {inv.truckCode
                          ? `${inv.truckCode} · ${inv.truckName}`
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-600 font-semibold">{fmtGal(inv.gallons)}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{fmtRD(inv.pricePerGallon)}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800">{fmtRD(inv.total)}</td>
                      <td className="px-3 py-3 text-right text-emerald-600 font-semibold">{fmtRD(inv.amountPaid)}</td>
                      <td className="px-3 py-3 text-right font-bold">
                        <span className={inv.balanceDue > 0 ? "text-red-600" : "text-slate-400"}>
                          {fmtRD(inv.balanceDue)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {inv.dueDate
                          ? <span className={overdue ? "text-red-600 font-semibold" : ""}>{fmtDate(inv.dueDate)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="pr-5 px-3 py-3 text-center">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Pagos Tab (full history) ─────────────────────────────────────────────────

function PagosTab({ data }: { data: CustomerDetailData }) {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  return (
    <div className="space-y-5">

      {/* Summary row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Total pagado"
          value={fmtRD(data.totalPaid)}
          sub="Acumulado histórico"
        />
        <KpiCard
          icon={Calendar}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Abonado este mes"
          value={fmtRD(data.totalPaidThisMonth)}
          sub={now.toLocaleDateString("es-DO", { month: "long", year: "numeric" })}
        />
        <KpiCard
          icon={Clock}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Último pago"
          value={data.lastPayment ? fmtDate(data.lastPayment.paymentDate) : "—"}
          sub={data.lastPayment ? fmtRD(data.lastPayment.amount) : "Sin pagos"}
        />
        <KpiCard
          icon={FileText}
          iconBg="bg-slate-50"
          iconColor="text-slate-500"
          label="Pagos registrados"
          value={data.paymentCount.toString()}
          sub="Historial completo"
        />
      </div>

      {/* Full history table */}
      <SectionCard title={`Historial de pagos — ${data.paymentCount} registros`}>
        {data.payments.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            Sin pagos registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Fecha","Hora","#Pago","Factura","Monto","Método","Referencia","Notas"].map((h, i) => (
                    <th key={h} className={cn(
                      "py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                      i === 0 ? "text-left pl-5" :
                      i === 4 ? "text-right px-3" :
                      i === 7 ? "text-left pr-5 px-3" : "text-left px-3",
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.payments.map(p => {
                  const dt = fmtDateTime(p.createdAt)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40">
                      <td className="pl-5 py-3 text-slate-700 font-medium">{dt.date}</td>
                      <td className="px-3 py-3 text-slate-400 font-mono">{dt.time}</td>
                      <td className="px-3 py-3 text-[10px] font-mono text-slate-500">{p.paymentNumber}</td>
                      <td className="px-3 py-3">
                        {p.invoiceNumber
                          ? <span className="font-mono text-blue-600 font-bold text-[10px]">{p.invoiceNumber}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600 text-sm">{fmtRD(p.amount)}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-semibold">
                          {PAYMENT_METHODS[p.paymentMethod] ?? p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {p.reference ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="pr-5 px-3 py-3 text-slate-400 max-w-[160px] truncate">
                        {p.notes ?? <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function PaymentsTable({
  payments, compact = false,
}: { payments: CustomerDetailData["payments"]; compact?: boolean }) {
  if (payments.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-200" />
        Sin pagos registrados
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-sans">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70">
            {["Fecha","Factura","Monto","Método"].map((h, i) => (
              <th key={h} className={cn(
                "py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                i === 0 ? "text-left pl-5" :
                i === 2 ? "text-right px-3" :
                i === 3 ? "text-left pr-5 px-3" : "text-left px-3",
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {payments.map(p => (
            <tr key={p.id} className="hover:bg-slate-50/40">
              <td className="pl-5 py-2.5 text-slate-600">{fmtDate(p.createdAt)}</td>
              <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] font-bold">
                {p.invoiceNumber ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{fmtRD(p.amount)}</td>
              <td className="pr-5 px-3 py-2.5 text-slate-500">
                {PAYMENT_METHODS[p.paymentMethod] ?? p.paymentMethod}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Camiones Tab ─────────────────────────────────────────────────────────────

function CamionesTab({ data }: { data: CustomerDetailData }) {
  if (data.trucks.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Truck className="w-10 h-10 mx-auto mb-2 text-slate-200" />
        <p className="text-sm font-medium">Sin camiones registrados</p>
      </div>
    )
  }
  return (
    <SectionCard>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {["Código","Nombre","Matrícula","Tipo","Estado","Galones facturados","% Total"].map((h, i) => (
                <th key={h} className={cn(
                  "py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]",
                  i === 0 ? "text-left pl-5" :
                  i >= 5 ? "text-right pr-5 px-3" : "text-left px-3",
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.trucks.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/40">
                <td className="pl-5 py-3.5 font-bold text-blue-600 font-mono">{t.code}</td>
                <td className="px-3 py-3.5 font-medium text-slate-800">{t.name}</td>
                <td className="px-3 py-3.5 text-slate-500">{t.plate ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-3.5 text-slate-600">{TRUCK_TYPES[t.type] ?? t.type}</td>
                <td className="px-3 py-3.5">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold",
                    t.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600",
                  )}>
                    {t.status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right font-semibold text-slate-800">
                  {fmtGal(t.gallonsBilled)}
                </td>
                <td className="pr-5 px-3 py-3.5 text-right">
                  <span className="text-slate-600 font-semibold">{t.pctOfTotal.toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

const TL_CONFIG: Record<TimelineEvent["type"], {
  icon:    React.ElementType
  iconBg:  string
  iconClr: string
  label:   string
}> = {
  supply: {
    icon:    Fuel,
    iconBg:  "bg-blue-100",
    iconClr: "text-blue-600",
    label:   "Suministro",
  },
  payment: {
    icon:    CheckCircle2,
    iconBg:  "bg-emerald-100",
    iconClr: "text-emerald-600",
    label:   "Pago",
  },
  invoice: {
    icon:    Receipt,
    iconBg:  "bg-amber-100",
    iconClr: "text-amber-600",
    label:   "Factura",
  },
}

function TimelineTab({ data }: { data: CustomerDetailData }) {
  const [filter, setFilter] = useState<"all" | TimelineEvent["type"]>("all")

  const events = filter === "all"
    ? data.timeline
    : data.timeline.filter(e => e.type === filter)

  if (data.timeline.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Clock className="w-10 h-10 mx-auto mb-2 text-slate-200" />
        <p className="text-sm font-medium">Sin actividad registrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { value: "all",     label: "Todo"         },
          { value: "supply",  label: "Suministros"  },
          { value: "payment", label: "Pagos"        },
          { value: "invoice", label: "Facturas"     },
        ] as const).map(opt => (
          <button key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
              filter === opt.value
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
            )}>
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs font-sans text-slate-400">
          {events.length} evento{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />

        <div className="space-y-1">
          {events.map((ev, idx) => {
            const cfg = TL_CONFIG[ev.type]
            const Icon = cfg.icon
            const isFirst = idx === 0 || (
              new Date(ev.date).toDateString() !==
              new Date(events[idx - 1].date).toDateString()
            )
            return (
              <div key={ev.id}>
                {/* Date separator */}
                {isFirst && (
                  <div className="flex items-center gap-3 py-2 pl-14 pr-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {new Date(ev.date).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                )}

                <div className="flex items-start gap-4 py-2 pl-2 pr-4 hover:bg-slate-50/70 rounded-xl transition-colors group">
                  {/* Icon bubble */}
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-white",
                    cfg.iconBg,
                  )}>
                    <Icon className={cn("w-3.5 h-3.5", cfg.iconClr)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{ev.title}</p>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5 truncate">{ev.subtitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {ev.amount !== undefined && (
                          <p className={cn(
                            "text-xs font-bold tabular-nums",
                            ev.type === "payment" ? "text-emerald-600" : "text-slate-700",
                          )}>
                            {ev.type === "payment" ? "+" : ""}RD${ev.amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                          {new Date(ev.date).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Invoice status badge */}
                    {ev.type === "invoice" && ev.status && (
                      <div className="mt-1">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                          INVOICE_STATUS[ev.status]?.cls ?? "bg-slate-50 text-slate-500",
                        )}>
                          {INVOICE_STATUS[ev.status]?.label ?? ev.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
