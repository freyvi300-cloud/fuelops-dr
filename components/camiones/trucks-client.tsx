"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Truck, Plus, Search, Bell, ChevronDown, Users,
  CheckCircle2, Ban, Pencil, Eye, MoreHorizontal,
  X, ChevronLeft, ChevronRight, Filter, Wrench,
  Zap, Tag, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedTruck, TruckFormData, TruckStats } from "@/app/actions/trucks"
import type { SerializedCustomer } from "@/app/actions/customers"
import {
  createTruck, updateTruck, deactivateTruck, activateTruck,
} from "@/app/actions/trucks"

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8

const TRUCK_TYPE_LABELS: Record<string, string> = {
  TRUCK:     "Camión",
  TRAILER:   "Tráiler",
  EQUIPMENT: "Equipo",
  GENERATOR: "Generador",
  OTHER:     "Otro",
}

const TRUCK_TYPE_ICONS: Record<string, React.ElementType> = {
  TRUCK:     Truck,
  TRAILER:   Truck,
  EQUIPMENT: Wrench,
  GENERATOR: Zap,
  OTHER:     Tag,
}

const AVATAR_PALETTE = [
  "bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500",
  "bg-pink-500","bg-indigo-500","bg-emerald-500","bg-rose-500",
  "bg-amber-500","bg-cyan-500","bg-sky-500","bg-fuchsia-500",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE"
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
      active
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-red-50 text-red-600 border-red-100"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500" : "bg-red-500")} />
      {active ? "Activo" : "Inactivo"}
    </span>
  )
}

// ─── Code badge ───────────────────────────────────────────────────────────────

function CodeBadge({ code }: { code: string }) {
  return (
    <span className="inline-block bg-[#1a3fa0] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-widest font-mono">
      {code}
    </span>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor, label, value, sub,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 font-display tracking-tight mt-0.5 leading-tight">{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Customer combobox (reused from supply form) ──────────────────────────────

function CustomerCombobox({
  customers, value, onChange,
}: {
  customers: SerializedCustomer[]
  value: string
  onChange: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = customers.find(c => c.id === value) ?? null
  const filtered = customers.filter(c =>
    c.status === "ACTIVE" &&
    c.name.toLowerCase().includes(query.toLowerCase())
  )

  function select(c: SerializedCustomer) {
    onChange(c.id, c.name)
    setQuery("")
    setOpen(false)
  }

  const INPUT_CLS = "w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"

  if (selected) {
    return (
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(selected.name))}>
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{selected.name}</p>
            {selected.phone && <p className="text-[11px] font-sans text-slate-500">{selected.phone}</p>}
          </div>
        </div>
        <button type="button" onClick={() => { onChange("", ""); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input ref={inputRef} type="text" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar cliente activo..."
          className={INPUT_CLS} />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm font-sans text-slate-400 text-center py-3">
              {query ? "Sin resultados" : "No hay clientes activos"}
            </p>
          ) : (
            <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50">
              {filtered.map(c => (
                <li key={c.id}>
                  <button type="button" onMouseDown={() => select(c)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.name))}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      {c.phone && <p className="text-[11px] font-sans text-slate-400">{c.phone}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
const LABEL = "block text-xs font-medium text-slate-600 mb-1.5"
const SELECT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"

const TRUCK_TYPES = [
  { value: "TRUCK",     label: "Camión" },
  { value: "TRAILER",   label: "Tráiler / Remolque" },
  { value: "EQUIPMENT", label: "Equipo / Maquinaria" },
  { value: "GENERATOR", label: "Generador" },
  { value: "OTHER",     label: "Otro" },
]

interface TruckFormProps {
  truck: SerializedTruck | null
  customers: SerializedCustomer[]
  nextCode: string
  onSubmit: (data: TruckFormData) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}

function TruckForm({ truck, customers, nextCode, onSubmit, onCancel, isPending, error }: TruckFormProps) {
  const [customerId, setCustomerId] = useState(truck?.customerId ?? "")

  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!customerId) return
    const fd = new FormData(e.currentTarget)
    onSubmit({
      customerId,
      code:   fd.get("code") as string,
      name:   fd.get("name") as string,
      plate:  (fd.get("plate") as string) || null,
      type:   fd.get("type") as "TRUCK" | "TRAILER" | "EQUIPMENT" | "GENERATOR" | "OTHER",
      status: (fd.get("status") as "ACTIVE" | "INACTIVE" | undefined) ?? undefined,
      notes:  (fd.get("notes") as string) || null,
    })
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs font-sans text-red-700">{error}</p>
        </div>
      )}

      {/* Cliente */}
      <div>
        <label className={LABEL}>Cliente <span className="text-red-500">*</span></label>
        <CustomerCombobox
          customers={customers}
          value={customerId}
          onChange={(id) => setCustomerId(id)}
        />
        {!customerId && (
          <p className="text-[11px] font-sans text-slate-400 mt-1.5">
            Selecciona un cliente para asociar este equipo.
          </p>
        )}
      </div>

      {/* Rótulo + Nombre */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            Rótulo del camión <span className="text-red-500">*</span>
            <span className="ml-1.5 text-slate-400 font-normal normal-case">(único)</span>
          </label>
          <input name="code" required
            defaultValue={truck?.code ?? nextCode}
            placeholder="H211"
            className={cn(INPUT, "uppercase font-mono tracking-wider")}
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div>
          <label className={LABEL}>Nombre / descripción <span className="text-red-500">*</span></label>
          <input name="name" required defaultValue={truck?.name ?? ""}
            placeholder="Ej: Volvo rojo 18 ruedas" className={INPUT} autoFocus={!truck} />
        </div>
      </div>

      {/* Placa + Tipo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Placa</label>
          <input name="plate" defaultValue={truck?.plate ?? ""}
            placeholder="A-12345" className={cn(INPUT, "uppercase")}
            style={{ textTransform: "uppercase" }} />
        </div>
        <div>
          <label className={LABEL}>Tipo</label>
          <select name="type" defaultValue={truck?.type ?? "TRUCK"} className={SELECT}>
            {TRUCK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado (solo en edición) */}
      {truck && (
        <div>
          <label className={LABEL}>Estado</label>
          <select name="status" defaultValue={truck.status} className={SELECT}>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
      )}

      {/* Notas */}
      <div>
        <label className={LABEL}>Notas</label>
        <textarea name="notes" rows={2} defaultValue={truck?.notes ?? ""}
          placeholder="Observaciones sobre el equipo..."
          className={cn(INPUT, "resize-none")} />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isPending || !customerId}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
          {isPending ? "Guardando..." : truck ? "Guardar cambios" : "Registrar equipo"}
        </button>
      </div>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  trucks: SerializedTruck[]
  stats: TruckStats
  customers: SerializedCustomer[]
  nextCode: string
  initialSearch: string
}

export default function TrucksClient({ trucks, stats, customers, nextCode, initialSearch }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SerializedTruck | null>(null)
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [page, setPage] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filtered = trucks.filter(t => {
    const matchesSearch = !q || [t.code, t.name, t.plate ?? "", t.customerName]
      .some(v => v.toLowerCase().includes(q))
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // ── Actions ────────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setFormError(null); setModalOpen(true) }
  function openEdit(t: SerializedTruck) { setEditing(t); setFormError(null); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null); setFormError(null) }

  function handleSubmit(data: TruckFormData) {
    setFormError(null)
    startTransition(async () => {
      try {
        editing ? await updateTruck(editing.id, data) : await createTruck(data)
        closeModal()
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Error al guardar el equipo.")
      }
    })
  }

  function handleToggle(t: SerializedTruck) {
    const verb = t.status === "ACTIVE" ? "desactivar" : "activar"
    if (!confirm(`¿Seguro que deseas ${verb} "${t.name}" (${t.code})?`)) return
    startTransition(async () => {
      t.status === "ACTIVE" ? await deactivateTruck(t.id) : await activateTruck(t.id)
      router.refresh()
    })
  }

  const statusLabels: Record<string, string> = { ALL: "Todos", ACTIVE: "Activos", INACTIVE: "Inactivos" }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ══ PAGE HEADER ══════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-start gap-4">
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Camiones / Equipos</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Gestiona los vehículos y equipos asociados a tus clientes.
            </p>
          </div>

          {/* Search */}
          <div className="relative hidden xl:block w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar equipo..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
          </div>

          {/* Bell */}
          <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors shrink-0">
            <Bell className="w-5 h-5 text-slate-500" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">3</span>
          </button>

          {/* User */}
          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-xl px-2.5 py-2 transition-colors shrink-0">
            <div className="w-8 h-8 bg-[#1a3fa0] rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-slate-800 hidden lg:block">Administrador</span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
          </button>

          {/* Add button */}
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200 shrink-0">
            <Plus className="w-4 h-4" />
            Registrar camión
          </button>
        </div>
      </div>

      {/* ══ SCROLLABLE BODY ══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard icon={Truck}        iconBg="bg-blue-50"    iconColor="text-blue-600"
            label="Total Equipos" value={stats.total.toString()}
            sub={
              <div className="flex items-center gap-3 text-[11px] font-sans">
                <span className="text-slate-500">Activos: <span className="font-bold text-emerald-600">{stats.active}</span></span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Inactivos: <span className="font-bold text-red-500">{stats.inactive}</span></span>
              </div>
            }
          />
          <KpiCard icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600"
            label="Activos" value={stats.active.toString()}
            sub={<p className="text-[11px] font-sans text-slate-400">En operación</p>}
          />
          <KpiCard icon={Ban}          iconBg="bg-red-50"     iconColor="text-red-500"
            label="Inactivos" value={stats.inactive.toString()}
            sub={<p className="text-[11px] font-sans text-slate-400">Fuera de servicio</p>}
          />
          <KpiCard icon={Users}        iconBg="bg-violet-50"  iconColor="text-violet-600"
            label="Clientes con equipos" value={stats.customersWithTrucks.toString()}
            sub={<p className="text-[11px] font-sans text-slate-400">Clientes registrados</p>}
          />
        </div>

        {/* ── Search + Filter ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por rótulo, nombre, placa o cliente..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              style={{ boxShadow: "var(--shadow-card)" }}
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <button onClick={() => setShowStatusMenu(v => !v)}
              onBlur={() => setTimeout(() => setShowStatusMenu(false), 150)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition-all"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <Filter className="w-4 h-4 text-slate-400" />
              Estado: {statusLabels[statusFilter]}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                {(["ALL","ACTIVE","INACTIVE"] as const).map(s => (
                  <button key={s} onMouseDown={() => { setStatusFilter(s); setPage(1); setShowStatusMenu(false) }}
                    className={cn("w-full text-left px-4 py-2.5 text-sm font-sans transition-colors",
                      statusFilter === s ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50")}>
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Table card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Truck className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {search || statusFilter !== "ALL" ? "No se encontraron equipos" : "No hay equipos registrados"}
              </p>
              <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
                {search || statusFilter !== "ALL"
                  ? "Intenta con otros filtros."
                  : "Registra el primer vehículo o equipo para comenzar."}
              </p>
              {!search && statusFilter === "ALL" && (
                <button onClick={openCreate}
                  className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Registrar primer equipo
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm min-w-[750px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {["RÓTULO","NOMBRE / DESCRIPCIÓN","CLIENTE","TIPO","PLACA","ESTADO","ACCIONES"].map((h, i) => (
                        <th key={h} className={cn(
                          "text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-3.5",
                          i === 0 ? "text-left pl-5 pr-4" :
                          i === 6 ? "text-center px-5" : "text-left px-4"
                        )}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map(t => {
                      const TypeIcon = TRUCK_TYPE_ICONS[t.type] ?? Truck
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Rótulo */}
                          <td className="pl-5 pr-4 py-4">
                            <CodeBadge code={t.code} />
                          </td>

                          {/* Nombre */}
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-800">{t.name}</p>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(t.customerName))}>
                                {t.customerName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-slate-600 truncate max-w-[140px]">{t.customerName}</span>
                            </div>
                          </td>

                          {/* Tipo */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <TypeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-600">{TRUCK_TYPE_LABELS[t.type] ?? t.type}</span>
                            </div>
                          </td>

                          {/* Placa */}
                          <td className="px-4 py-4">
                            {t.plate
                              ? <span className="font-mono text-slate-700 tracking-wide">{t.plate}</span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-4">
                            <StatusBadge status={t.status} />
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(t)} title="Editar"
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button title="Ver detalles"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleToggle(t)} disabled={isPending}
                                title={t.status === "ACTIVE" ? "Desactivar" : "Activar"}
                                className={cn("p-1.5 rounded-lg transition-colors disabled:opacity-50",
                                  t.status === "ACTIVE"
                                    ? "text-slate-400 hover:text-orange-500 hover:bg-orange-50"
                                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50")}>
                                {t.status === "ACTIVE" ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                              <button title="Más opciones"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs font-sans text-slate-500">
                  Mostrando{" "}
                  <span className="font-semibold text-slate-700">{(safePage - 1) * ITEMS_PER_PAGE + 1}</span>
                  {" "}a{" "}
                  <span className="font-semibold text-slate-700">{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span>
                  {" "}de{" "}
                  <span className="font-semibold text-slate-700">{filtered.length}</span> equipos
                </p>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={cn("w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                        n === safePage ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-100")}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL ════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {editing ? "Editar equipo" : "Registrar equipo"}
                </h2>
                {!editing && (
                  <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                    El rótulo se genera automáticamente y puede editarse.
                  </p>
                )}
              </div>
              <button onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <TruckForm
                truck={editing}
                customers={customers}
                nextCode={nextCode}
                onSubmit={handleSubmit}
                onCancel={closeModal}
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
