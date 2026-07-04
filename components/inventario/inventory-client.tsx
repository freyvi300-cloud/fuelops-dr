"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Droplets, Plus, Bell, ChevronDown, TrendingUp,
  TrendingDown, Clock, X, AlertCircle, ChevronLeft,
  ChevronRight, Fuel, Wrench, Search, CalendarDays,
  TriangleAlert, Gauge, Calendar,
} from "lucide-react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import type { SerializedMovement, MovementFormData, InventoryStats } from "@/app/actions/inventory"
import { createMovement } from "@/app/actions/inventory"

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10

const MOVEMENT_CONFIG = {
  IN: {
    label:   "Entrada",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dotCls:   "bg-emerald-500",
    signCls:  "text-emerald-600",
    sign:     "+",
  },
  OUT: {
    label:    "Salida",
    badgeCls: "bg-red-50 text-red-600 border-red-100",
    dotCls:   "bg-red-500",
    signCls:  "text-red-600",
    sign:     "-",
  },
  ADJUSTMENT: {
    label:    "Ajuste",
    badgeCls: "bg-amber-50 text-amber-700 border-amber-100",
    dotCls:   "bg-amber-500",
    signCls:  "text-amber-600",
    sign:     "±",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtGal(n: number, decimals = 2) {
  return `${Math.abs(n).toLocaleString("es-DO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} gal`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
}

// ─── Alert banner ─────────────────────────────────────────────────────────────

function AlertBanner({ stats }: { stats: InventoryStats }) {
  if (stats.alertLevel === "normal") return null
  const red = stats.alertLevel === "red"
  return (
    <div className={cn(
      "flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-sans",
      red
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-amber-50 border-amber-200 text-amber-800",
    )}>
      <TriangleAlert className={cn("w-5 h-5 shrink-0 mt-0.5", red ? "text-red-500" : "text-amber-500")} />
      <div>
        <p className="font-semibold">
          {red
            ? `¡Stock crítico! Solo ${fmtGal(stats.availableGallons)} disponibles`
            : `Inventario bajo — ${fmtGal(stats.availableGallons)} disponibles`}
        </p>
        <p className={cn("text-xs mt-0.5", red ? "text-red-600" : "text-amber-700")}>
          {red
            ? `Umbral crítico: ${fmtGal(stats.alertRedGallons)}. Considera realizar un pedido urgente.`
            : `Umbral de alerta: ${fmtGal(stats.alertYellowGallons)}. Planifica la próxima carga.`}
          {stats.daysRemaining !== null && ` Quedan aproximadamente ${stats.daysRemaining} días de combustible.`}
        </p>
      </div>
    </div>
  )
}

// ─── Consumption chart ────────────────────────────────────────────────────────

function ConsumptionChart({ stats }: { stats: InventoryStats }) {
  const data = stats.consumptionChart
  const hasData = data.some(d => d.salidas > 0)

  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Consumo últimos 30 días</h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-sans mt-0.5">Salidas diarias (barras) y balance del tanque (línea)</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-sans text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
            Balance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-400 inline-block" />
            Salidas / día
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-slate-300 font-sans">Sin salidas en los últimos 30 días</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-sans)" }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-sans)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toLocaleString("es-DO")}
              width={52}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-sans)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toLocaleString("es-DO")}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                color: "var(--chart-tooltip-color)",
                borderRadius: 10, fontSize: 11, fontFamily: "var(--font-sans)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
              labelStyle={{ color: "var(--chart-tooltip-label)" }}
              formatter={(value, name) => [
                `${Number(value).toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal`,
                name === "salidas" ? "Salidas" : "Balance",
              ]}
            />
            <Bar
              yAxisId="left"
              dataKey="salidas"
              fill="#f87171"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="balance"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor, label, value, sub, highlight,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: React.ReactNode; highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex items-center gap-4",
        highlight
          ? "bg-[#1a3fa0] border-blue-700"
          : "bg-white border-slate-100"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
          highlight ? "text-blue-200" : "text-slate-500")}>
          {label}
        </p>
        <p className={cn("text-xl font-bold font-display tracking-tight mt-0.5 leading-tight",
          highlight ? "text-white" : "text-slate-900")}>
          {value}
        </p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Movement type badge ──────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = MOVEMENT_CONFIG[type as keyof typeof MOVEMENT_CONFIG]
  if (!cfg) return null
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
      cfg.badgeCls
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotCls)} />
      {cfg.label}
    </span>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
const LABEL = "block text-xs font-medium text-slate-600 mb-1.5"
const SELECT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"

const MOVEMENT_OPTIONS = [
  { value: "IN",         label: "Entrada de combustible",    hint: "Registrar combustible recibido del proveedor" },
  { value: "ADJUSTMENT", label: "Ajuste de inventario",      hint: "Corregir diferencias del medidor (puede ser negativo)" },
]

function MovementForm({
  onSubmit, onCancel, isPending, error,
}: {
  onSubmit: (d: MovementFormData) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}) {
  const [type, setType] = useState<"IN" | "ADJUSTMENT">("IN")
  const isAdjustment = type === "ADJUSTMENT"

  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const gallonsRaw = parseFloat(fd.get("gallons") as string)
    const cost       = parseFloat(fd.get("costPerGallon") as string)
    onSubmit({
      type:          fd.get("type") as "IN" | "ADJUSTMENT",
      gallons:       gallonsRaw,
      costPerGallon: !isNaN(cost) && cost > 0 ? cost : null,
      reference:     (fd.get("reference") as string) || null,
      description:   (fd.get("description") as string) || null,
      movedAt:       fd.get("movedAt") as string,
    })
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs font-sans text-red-700">{error}</p>
        </div>
      )}

      {/* Tipo */}
      <div>
        <label className={LABEL}>Tipo de movimiento</label>
        <div className="grid grid-cols-2 gap-3">
          {MOVEMENT_OPTIONS.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => setType(opt.value as "IN" | "ADJUSTMENT")}
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all",
                type === opt.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <span className={cn("text-xs font-bold",
                type === opt.value ? "text-blue-700" : "text-slate-700")}>{opt.label}</span>
              <span className="text-[10px] font-sans text-slate-400 leading-snug">{opt.hint}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      {/* Fecha + Galones */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Fecha del movimiento</label>
          <input name="movedAt" type="datetime-local" defaultValue={todayISO()}
            required className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>
            Galones
            {isAdjustment && <span className="ml-1 text-amber-600 font-normal">(puede ser negativo)</span>}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input name="gallons" type="number" step="0.01"
            min={isAdjustment ? undefined : "0.01"}
            placeholder={isAdjustment ? "ej: -50 o +200" : "0.00"}
            required className={cn(INPUT, "text-right font-semibold")}
          />
        </div>
      </div>

      {/* Precio por galón (solo IN) */}
      {!isAdjustment && (
        <div>
          <label className={LABEL}>Precio de compra / galón (RD$) <span className="text-slate-400 font-normal">— opcional</span></label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">RD$</span>
            <input name="costPerGallon" type="number" min="0" step="0.01"
              placeholder="0.00"
              className={cn(INPUT, "pl-12 text-right font-semibold")}
            />
          </div>
        </div>
      )}

      {/* Referencia */}
      <div>
        <label className={LABEL}>Referencia <span className="text-slate-400 font-normal">— # factura proveedor, nota interna</span></label>
        <input name="reference" type="text"
          placeholder={isAdjustment ? "Motivo del ajuste" : "Factura #001 / Proveedor XYZ"}
          className={INPUT}
        />
      </div>

      {/* Descripción */}
      <div>
        <label className={LABEL}>Nota adicional <span className="text-slate-400 font-normal">— opcional</span></label>
        <textarea name="description" rows={2}
          placeholder="Observaciones del movimiento..."
          className={cn(INPUT, "resize-none")}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
          {isPending ? "Registrando..." : "Registrar movimiento"}
        </button>
      </div>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  movements: SerializedMovement[]
  stats: InventoryStats
}

export default function InventoryClient({ movements, stats }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT" | "ADJUSTMENT">("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo,   setDateTo]   = useState("")
  const [page, setPage] = useState(1)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filtered = movements.filter(m => {
    const matchesSearch = !q || [m.reference ?? "", m.description ?? ""]
      .some(v => v.toLowerCase().includes(q))
    const matchesType = typeFilter === "ALL" || m.type === typeFilter
    const d = new Date(m.movedAt)
    const afterFrom = !dateFrom || d >= new Date(dateFrom + "T00:00:00")
    const beforeTo  = !dateTo   || d <= new Date(dateTo   + "T23:59:59")
    return matchesSearch && matchesType && afterFrom && beforeTo
  })

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function handleSubmit(data: MovementFormData) {
    setFormError(null)
    startTransition(async () => {
      try {
        await createMovement(data)
        setModalOpen(false)
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Error al registrar el movimiento.")
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-4 sm:px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Inventario</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Control del combustible disponible y movimientos del tanque.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative hidden xl:block w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar referencia..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
            <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">3</span>
            </button>
            <button className="flex items-center gap-2 hover:bg-slate-50 rounded-xl px-2.5 py-2 transition-colors">
              <div className="w-8 h-8 bg-[#1a3fa0] rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 hidden lg:block">Administrador</span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
            </button>
          </div>

          <button onClick={() => { setFormError(null); setModalOpen(true) }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200">
            <Plus className="w-4 h-4" />
            Registrar entrada
          </button>
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Alert banner ───────────────────────────────────────────────── */}
        <AlertBanner stats={stats} />

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Combustible disponible — highlighted card */}
          <KpiCard
            icon={Droplets}
            iconBg="bg-white/20"
            iconColor="text-white"
            label="Combustible disponible"
            value={fmtGal(Math.max(0, stats.availableGallons))}
            highlight
            sub={
              stats.tankCapacity > 0 ? (
                <div className="mt-1.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-blue-200 font-sans">Llenado del tanque</span>
                    <span className="text-[10px] text-white font-bold">{stats.fillPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stats.fillPct}%`,
                        background: stats.fillPct <= 15 ? "#f87171" : stats.fillPct <= 30 ? "#fbbf24" : "#86efac",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-sans text-blue-200">Nivel actual del tanque</p>
              )
            }
          />

          <KpiCard
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Recibido este mes"
            value={fmtGal(stats.receivedThisMonth)}
            sub={<p className="text-[11px] font-sans text-slate-400">Entradas acumuladas</p>}
          />

          <KpiCard
            icon={TrendingDown}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            label="Vendido este mes"
            value={fmtGal(stats.soldThisMonth)}
            sub={
              <p className="text-[11px] font-sans text-slate-400">
                Esta semana: {fmtGal(stats.soldThisWeek)}
              </p>
            }
          />

          <KpiCard
            icon={CalendarDays}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            label="Proyección de días"
            value={stats.daysRemaining !== null ? `${stats.daysRemaining} días` : "—"}
            sub={
              <p className="text-[11px] font-sans text-slate-400">
                Prom. diario: {fmtGal(stats.avgDailyConsumption, 1)}
              </p>
            }
          />
        </div>

        {/* ── Consumption chart ────────────────────────────────────────────── */}
        <ConsumptionChart stats={stats} />

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-4 space-y-3"
          style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Row 1: search + date range */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar referencia o descripción..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
            {/* Date from */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  className="pl-8 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <span className="text-slate-400 text-xs font-medium">—</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  className="pl-8 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(1) }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Limpiar fechas">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: type filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tipo:</span>
            {([
              { value: "ALL",        label: "Todos"    },
              { value: "IN",         label: "Entradas" },
              { value: "OUT",        label: "Salidas"  },
              { value: "ADJUSTMENT", label: "Ajustes"  },
            ] as const).map(opt => (
              <button key={opt.value}
                onClick={() => { setTypeFilter(opt.value); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                  typeFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}>
                {opt.label}
              </button>
            ))}
            {(search || typeFilter !== "ALL" || dateFrom || dateTo) && (
              <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* ── Table / Empty state ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Fuel className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {movements.length === 0 ? "No hay movimientos registrados" : "Sin resultados para este filtro"}
              </p>
              <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
                {movements.length === 0
                  ? "Registra la primera entrada de combustible para comenzar a controlar el inventario."
                  : "Prueba con otros términos o cambia el filtro de tipo."}
              </p>
              {movements.length === 0 && (
                <button onClick={() => setModalOpen(true)}
                  className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" />
                  Registrar primera entrada
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                      {[
                        { label: "FECHA",         cls: "text-left pl-5 pr-4" },
                        { label: "TIPO",           cls: "text-left px-4" },
                        { label: "GALONES",        cls: "text-right px-4" },
                        { label: "REFERENCIA",     cls: "text-left px-4" },
                        { label: "PRECIO / GAL",   cls: "text-right px-4" },
                        { label: "ACCIONES",       cls: "text-center px-5 w-16" },
                      ].map(h => (
                        <th key={h.label}
                          className={cn("text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3.5", h.cls)}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map(m => {
                      const cfg = MOVEMENT_CONFIG[m.type as keyof typeof MOVEMENT_CONFIG]
                      const isOut = m.type === "OUT"
                      const displayGallons = isOut ? -m.gallons : m.gallons
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Fecha */}
                          <td className="pl-5 pr-4 py-4">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{fmtDate(m.movedAt)}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                              {new Date(m.movedAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>

                          {/* Tipo */}
                          <td className="px-4 py-4"><TypeBadge type={m.type} /></td>

                          {/* Galones */}
                          <td className="px-4 py-4 text-right">
                            <span className={cn("font-bold tabular-nums", cfg?.signCls ?? "text-slate-700")}>
                              {displayGallons >= 0 ? "+" : ""}
                              {displayGallons.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal
                            </span>
                          </td>

                          {/* Referencia / descripción */}
                          <td className="px-4 py-4 max-w-[220px]">
                            {m.reference && (
                              <p className="font-medium text-slate-700 truncate">{m.reference}</p>
                            )}
                            {m.description && (
                              <p className="text-[11px] font-sans text-slate-400 truncate mt-0.5">{m.description}</p>
                            )}
                            {!m.reference && !m.description && (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Precio / gal */}
                          <td className="px-4 py-4 text-right font-sans">
                            {m.costPerGallon != null
                              ? <span className="font-medium text-slate-700">
                                  RD${m.costPerGallon.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-4 text-center">
                            <button
                              title="Ver detalles"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-xs font-sans text-slate-500">
                  Mostrando{" "}
                  <span className="font-semibold text-slate-700">{(safePage - 1) * ITEMS_PER_PAGE + 1}</span>
                  {" "}a{" "}
                  <span className="font-semibold text-slate-700">{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span>
                  {" "}de{" "}
                  <span className="font-semibold text-slate-700">{filtered.length}</span> movimientos
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn("w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                          n === safePage ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100")}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL ════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Registrar movimiento</h2>
                <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                  Las salidas se generan automáticamente al confirmar suministros.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <MovementForm
                onSubmit={handleSubmit}
                onCancel={() => setModalOpen(false)}
                isPending={isPending}
                error={formError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
