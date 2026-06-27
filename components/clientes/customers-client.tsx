"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Users, Plus, Search, Pencil, Ban, CheckCircle2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedCustomer, CustomerFormData } from "@/app/actions/customers"
import {
  createCustomer, updateCustomer,
  deactivateCustomer, activateCustomer,
} from "@/app/actions/customers"

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE"
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
      active
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-100 text-slate-500 border-slate-200"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        active ? "bg-emerald-500" : "bg-slate-400"
      )} />
      {active ? "Activo" : "Inactivo"}
    </span>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
        <Users className="w-7 h-7 text-slate-300" />
      </div>
      <p className="font-semibold text-slate-700 text-sm">
        {hasSearch ? "No se encontraron clientes" : "No hay clientes registrados"}
      </p>
      <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
        {hasSearch
          ? "Intenta con otro término de búsqueda."
          : "Agrega tu primer cliente para comenzar a registrar ventas y suministros."}
      </p>
      {!hasSearch && (
        <button
          onClick={onAdd}
          className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar primer cliente
        </button>
      )}
    </div>
  )
}

// ─── Form styles ──────────────────────────────────────────────────────────────

const INPUT = cn(
  "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans",
  "text-slate-800 placeholder:text-slate-400 bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
)
const LABEL = "block text-xs font-medium text-slate-600 mb-1.5"

// ─── Customer form ────────────────────────────────────────────────────────────

interface CustomerFormProps {
  customer: SerializedCustomer | null
  onSubmit: (data: CustomerFormData) => void
  onCancel: () => void
  isPending: boolean
}

function CustomerForm({ customer, onSubmit, onCancel, isPending }: CustomerFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const creditStr = fd.get("creditLimit") as string
    onSubmit({
      name: fd.get("name") as string,
      phone: (fd.get("phone") as string) || null,
      email: (fd.get("email") as string) || null,
      address: (fd.get("address") as string) || null,
      rnc: (fd.get("rnc") as string) || null,
      creditLimit: creditStr ? parseFloat(creditStr) : 0,
      notes: (fd.get("notes") as string) || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className={LABEL}>
          Nombre del cliente <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={customer?.name ?? ""}
          required
          placeholder="Ej: Transporte González SRL"
          className={INPUT}
          autoFocus
        />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Teléfono</label>
          <input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            placeholder="809-000-0000"
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Correo electrónico</label>
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            placeholder="cliente@correo.com"
            className={INPUT}
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className={LABEL}>Dirección</label>
        <input
          name="address"
          defaultValue={customer?.address ?? ""}
          placeholder="Calle, ciudad, provincia"
          className={INPUT}
        />
      </div>

      {/* RNC + Credit Limit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>RNC</label>
          <input
            name="rnc"
            defaultValue={customer?.rnc ?? ""}
            placeholder="000-00000-0"
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Límite de crédito (RD$)</label>
          <input
            name="creditLimit"
            type="number"
            min="0"
            step="0.01"
            defaultValue={customer?.creditLimit ?? 0}
            placeholder="0.00"
            className={INPUT}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={LABEL}>Notas</label>
        <textarea
          name="notes"
          defaultValue={customer?.notes ?? ""}
          rows={3}
          placeholder="Información adicional sobre el cliente..."
          className={cn(INPUT, "resize-none")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {isPending
            ? "Guardando..."
            : customer ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  )
}

// ─── Customers table ──────────────────────────────────────────────────────────

interface TableProps {
  customers: SerializedCustomer[]
  onEdit: (c: SerializedCustomer) => void
  onToggleStatus: (c: SerializedCustomer) => void
  isPending: boolean
}

function CustomersTable({ customers, onEdit, onToggleStatus, isPending }: TableProps) {
  const fmt = (n: number) =>
    `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-sans text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70">
            <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
              Cliente
            </th>
            <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3.5 hidden md:table-cell">
              Teléfono
            </th>
            <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3.5 hidden lg:table-cell">
              Email
            </th>
            <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3.5">
              Límite crédito
            </th>
            <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3.5">
              Balance
            </th>
            <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3.5">
              Estado
            </th>
            <th className="px-5 py-3.5 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-800 leading-tight">{c.name}</p>
                {c.rnc && (
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">RNC: {c.rnc}</p>
                )}
              </td>
              <td className="px-4 py-4 text-slate-500 font-sans hidden md:table-cell">
                {c.phone ?? <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-4 text-slate-500 font-sans hidden lg:table-cell">
                {c.email ?? <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-4 text-right font-medium text-slate-700 font-sans">
                {fmt(c.creditLimit)}
              </td>
              <td className="px-4 py-4 text-right font-sans">
                <span className={cn(
                  "font-semibold",
                  c.currentBalance > 0 ? "text-red-600" : "text-slate-700"
                )}>
                  {fmt(c.currentBalance)}
                </span>
              </td>
              <td className="px-4 py-4 text-center">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(c)}
                    title="Editar cliente"
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onToggleStatus(c)}
                    title={c.status === "ACTIVE" ? "Desactivar" : "Activar"}
                    disabled={isPending}
                    className={cn(
                      "p-2 rounded-lg transition-colors disabled:opacity-50",
                      c.status === "ACTIVE"
                        ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                    )}
                  >
                    {c.status === "ACTIVE"
                      ? <Ban className="w-4 h-4" />
                      : <CheckCircle2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CustomersClientProps {
  customers: SerializedCustomer[]
  initialSearch: string
}

export default function CustomersClient({ customers, initialSearch }: CustomersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<SerializedCustomer | null>(null)
  const [searchValue, setSearchValue] = useState(initialSearch)

  // Debounced URL-based search — triggers server re-render with filtered data
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (searchValue.trim()) params.set("q", searchValue.trim())
      const qs = params.toString()
      router.replace(`/clientes${qs ? `?${qs}` : ""}`)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchValue, router])

  function openCreate() {
    setEditingCustomer(null)
    setModalOpen(true)
  }

  function openEdit(customer: SerializedCustomer) {
    setEditingCustomer(customer)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingCustomer(null)
  }

  function handleSubmit(data: CustomerFormData) {
    startTransition(async () => {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data)
      } else {
        await createCustomer(data)
      }
      closeModal()
      router.refresh()
    })
  }

  function handleToggleStatus(customer: SerializedCustomer) {
    const action = customer.status === "ACTIVE" ? "desactivar" : "activar"
    if (!confirm(`¿Seguro que deseas ${action} a "${customer.name}"?`)) return
    startTransition(async () => {
      if (customer.status === "ACTIVE") {
        await deactivateCustomer(customer.id)
      } else {
        await activateCustomer(customer.id)
      }
      router.refresh()
    })
  }

  const hasSearch = searchValue.trim().length > 0

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        className="bg-white border-b border-slate-100 px-6 py-5 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Clientes</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              {customers.length > 0
                ? `${customers.length} cliente${customers.length !== 1 ? "s" : ""} registrado${customers.length !== 1 ? "s" : ""}`
                : "Gestiona tus clientes y sus cuentas de crédito"}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar cliente</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {customers.length === 0 ? (
            <EmptyState hasSearch={hasSearch} onAdd={openCreate} />
          ) : (
            <CustomersTable
              customers={customers}
              onEdit={openEdit}
              onToggleStatus={handleToggleStatus}
              isPending={isPending}
            />
          )}
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {editingCustomer ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Form */}
            <div className="px-6 py-5">
              <CustomerForm
                customer={editingCustomer}
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
