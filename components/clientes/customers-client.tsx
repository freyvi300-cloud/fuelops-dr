"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, Bell, ChevronDown, Users, Droplets,
  DollarSign, Tag, Pencil, Eye, MoreHorizontal,
  Ban, CheckCircle2, X, ChevronLeft, ChevronRight,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedCustomer, CustomerFormData, CustomerStats } from "@/app/actions/customers"
import {
  createCustomer, updateCustomer,
  deactivateCustomer, activateCustomer,
} from "@/app/actions/customers"

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6

const AVATAR_PALETTE = [
  "bg-blue-500",  "bg-teal-500",   "bg-violet-500", "bg-orange-500",
  "bg-pink-500",  "bg-indigo-500", "bg-emerald-500","bg-rose-500",
  "bg-amber-500", "bg-cyan-500",   "bg-sky-500",    "bg-fuchsia-500",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
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

// ─── KPI cards ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  value: string
  sub?: React.ReactNode
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 font-display tracking-tight mt-0.5 leading-tight">
          {value}
        </p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
const LABEL = "block text-xs font-medium text-slate-600 mb-1.5"

function CustomerForm({
  customer,
  onSubmit,
  onCancel,
  isPending,
}: {
  customer: SerializedCustomer | null
  onSubmit: (d: CustomerFormData) => void
  onCancel: () => void
  isPending: boolean
}) {
  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const num = (key: string) => parseFloat(fd.get(key) as string) || 0
    onSubmit({
      name:               fd.get("name") as string,
      phone:              (fd.get("phone") as string)   || null,
      email:              (fd.get("email") as string)   || null,
      address:            (fd.get("address") as string) || null,
      rnc:                (fd.get("rnc") as string)     || null,
      creditLimit:        num("creditLimit"),
      pendingGallons:     num("pendingGallons"),
      fuelPricePerGallon: num("fuelPricePerGallon"),
      notes:              (fd.get("notes") as string)   || null,
    })
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div>
        <label className={LABEL}>Nombre <span className="text-red-500">*</span></label>
        <input name="name" defaultValue={customer?.name ?? ""} required
          placeholder="Ej: Transporte González SRL" className={INPUT} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Teléfono</label>
          <input name="phone" defaultValue={customer?.phone ?? ""}
            placeholder="809-000-0000" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Correo</label>
          <input name="email" type="email" defaultValue={customer?.email ?? ""}
            placeholder="cliente@correo.com" className={INPUT} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Dirección</label>
        <input name="address" defaultValue={customer?.address ?? ""}
          placeholder="Calle, ciudad, provincia" className={INPUT} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>RNC</label>
          <input name="rnc" defaultValue={customer?.rnc ?? ""}
            placeholder="0-00-00000-0" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Límite de crédito (RD$)</label>
          <input name="creditLimit" type="number" min="0" step="0.01"
            defaultValue={customer?.creditLimit ?? 0} className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Galones pendientes</label>
          <input name="pendingGallons" type="number" min="0" step="0.01"
            defaultValue={customer?.pendingGallons ?? 0} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Precio por galón (RD$)</label>
          <input name="fuelPricePerGallon" type="number" min="0" step="0.01"
            defaultValue={customer?.fuelPricePerGallon ?? 0} className={INPUT} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Notas</label>
        <textarea name="notes" rows={2} defaultValue={customer?.notes ?? ""}
          placeholder="Información adicional..." className={cn(INPUT, "resize-none")} />
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
          {isPending ? "Guardando..." : customer ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  customers: SerializedCustomer[]
  stats: CustomerStats
  initialSearch: string
}

export default function CustomersClient({ customers, stats, initialSearch }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SerializedCustomer | null>(null)
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [page, setPage] = useState(1)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filtered = customers.filter((c) => {
    const matchesSearch = !q || [c.name, c.phone ?? "", c.rnc ?? ""]
      .some((v) => v.toLowerCase().includes(q))
    const matchesStatus =
      statusFilter === "ALL" ||
      c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // ── Filtered totals (all filtered, not just page) ─────────────────────────
  const filteredGallons = filtered.reduce((s, c) => s + c.pendingGallons, 0)
  const filteredTotal   = filtered.reduce((s, c) => s + c.totalPending, 0)

  // ── Actions ────────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(c: SerializedCustomer) { setEditing(c); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(data: CustomerFormData) {
    startTransition(async () => {
      editing ? await updateCustomer(editing.id, data) : await createCustomer(data)
      closeModal(); router.refresh()
    })
  }

  function handleToggle(c: SerializedCustomer) {
    const verb = c.status === "ACTIVE" ? "desactivar" : "activar"
    if (!confirm(`¿Seguro que deseas ${verb} a "${c.name}"?`)) return
    startTransition(async () => {
      c.status === "ACTIVE" ? await deactivateCustomer(c.id) : await activateCustomer(c.id)
      router.refresh()
    })
  }

  const statusLabels: Record<string, string> = { ALL: "Todos", ACTIVE: "Activos", INACTIVE: "Inactivos" }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-start gap-4">
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clientes</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Administra tus clientes y consulta sus saldos de combustible.
            </p>
          </div>

          {/* Global search */}
          <div className="relative hidden xl:block w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar cliente..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
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
            Agregar cliente
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SCROLLABLE BODY
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Clientes totales */}
          <KpiCard
            icon={Users}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="Clientes Totales"
            value={stats.total.toString()}
            sub={
              <div className="flex items-center gap-3 text-[11px] font-sans">
                <span className="text-slate-500">
                  Activos: <span className="font-bold text-emerald-600">{stats.active}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">
                  Inactivos: <span className="font-bold text-red-500">{stats.inactive}</span>
                </span>
              </div>
            }
          />

          {/* Galones pendientes */}
          <KpiCard
            icon={Droplets}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            label="Galones Pendientes"
            value={fmtGal(stats.totalPendingGallons)}
            sub={<p className="text-[11px] font-sans text-slate-400">Total adeudado</p>}
          />

          {/* Total pendiente */}
          <KpiCard
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Total Pendiente"
            value={fmtRD(stats.totalPendingAmount)}
            sub={<p className="text-[11px] font-sans text-slate-400">Valor total adeudado</p>}
          />

          {/* Precio promedio */}
          <KpiCard
            icon={Tag}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            label="Precio Promedio / Gal"
            value={fmtRD(stats.avgPricePerGallon)}
            sub={<p className="text-[11px] font-sans text-slate-400">Precio promedio de venta</p>}
          />
        </div>

        {/* ── Search + Filter bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre, teléfono o RNC..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              style={{ boxShadow: "var(--shadow-card)" }}
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(v => !v)}
              onBlur={() => setTimeout(() => setShowStatusMenu(false), 150)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition-all"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Filter className="w-4 h-4 text-slate-400" />
              Estado: {statusLabels[statusFilter]}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => { setStatusFilter(s); setPage(1); setShowStatusMenu(false) }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm font-sans transition-colors",
                      statusFilter === s
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Table card ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {search || statusFilter !== "ALL" ? "No se encontraron clientes" : "No hay clientes registrados"}
              </p>
              <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
                {search || statusFilter !== "ALL"
                  ? "Intenta con otros filtros o términos de búsqueda."
                  : "Agrega tu primer cliente para comenzar."}
              </p>
              {!search && statusFilter === "ALL" && (
                <button onClick={openCreate}
                  className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" />
                  Agregar primer cliente
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {["CLIENTE","TELÉFONO","GALONES PENDIENTES","PRECIO / GAL","TOTAL PENDIENTE","ESTADO","ACCIONES"].map((h, i) => (
                        <th key={h} className={cn(
                          "text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-3.5",
                          i === 0 ? "text-left pl-5 pr-4" :
                          i === 6 ? "text-center px-5" :
                          i >= 2 && i <= 4 ? "text-right px-4" : "text-left px-4"
                        )}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map((c) => {
                      const color = avatarColor(c.name)
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Cliente */}
                          <td className="pl-5 pr-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold", color)}>
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate max-w-[180px]">{c.name}</p>
                                {c.rnc && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">RNC: {c.rnc}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Teléfono */}
                          <td className="px-4 py-4 text-slate-500">
                            {c.phone ?? <span className="text-slate-300">—</span>}
                          </td>

                          {/* Galones pendientes */}
                          <td className="px-4 py-4 text-right">
                            <span className={cn(
                              "font-semibold",
                              c.pendingGallons > 0 ? "text-blue-600" : "text-slate-400"
                            )}>
                              {fmtGal(c.pendingGallons)}
                            </span>
                          </td>

                          {/* Precio / galón */}
                          <td className="px-4 py-4 text-right font-medium text-slate-700">
                            {c.fuelPricePerGallon > 0
                              ? fmtRD(c.fuelPricePerGallon)
                              : <span className="text-slate-300">—</span>
                            }
                          </td>

                          {/* Total pendiente */}
                          <td className="px-4 py-4 text-right">
                            <span className={cn(
                              "font-bold",
                              c.totalPending > 0 ? "text-slate-900" : "text-slate-400"
                            )}>
                              {fmtRD(c.totalPending)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-4 text-center">
                            <StatusBadge status={c.status} />
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(c)} title="Editar"
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button title="Ver detalles"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggle(c)}
                                title={c.status === "ACTIVE" ? "Desactivar" : "Activar"}
                                disabled={isPending}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors disabled:opacity-50",
                                  c.status === "ACTIVE"
                                    ? "text-slate-400 hover:text-orange-500 hover:bg-orange-50"
                                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                )}>
                                {c.status === "ACTIVE"
                                  ? <Ban className="w-4 h-4" />
                                  : <CheckCircle2 className="w-4 h-4" />
                                }
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

              {/* ── Table footer ─────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
                {/* Count */}
                <p className="text-xs font-sans text-slate-500">
                  Mostrando{" "}
                  <span className="font-semibold text-slate-700">
                    {(safePage - 1) * ITEMS_PER_PAGE + 1}
                  </span>{" "}
                  a{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-slate-700">{filtered.length}</span>{" "}
                  clientes
                </p>

                {/* Totals */}
                <div className="flex items-center gap-4 text-xs font-sans">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Totales:</span>
                  <span className="font-bold text-blue-600">{fmtGal(filteredGallons)}</span>
                  <span className="font-bold text-slate-800">{fmtRD(filteredTotal)}</span>
                </div>

                {/* Pagination */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                        n === safePage
                          ? "bg-blue-600 text-white shadow-sm"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {editing ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <button onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <CustomerForm
                customer={editing}
                onSubmit={handleSubmit}
                onCancel={closeModal}
                isPending={isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
