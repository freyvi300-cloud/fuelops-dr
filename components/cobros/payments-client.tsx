"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter }                        from "next/navigation"
import {
  DollarSign, Bell, ChevronDown, Search, Users, Receipt,
  Banknote, ArrowRightLeft, Building2, FileText, MoreHorizontal,
  X, CheckCircle2, RotateCcw, AlertCircle,
  ChevronLeft, ChevronRight, Plus, Clock, Wallet,
} from "lucide-react"
import { cn }                          from "@/lib/utils"
import type { SerializedPayment, PaymentFormData, PaymentStats, PaymentResult } from "@/app/actions/payments"
import type { SerializedCustomer }     from "@/app/actions/customers"
import type { SerializedInvoice }      from "@/app/actions/invoices"
import { createPayment }               from "@/app/actions/payments"
import { getCustomerPendingInvoices }  from "@/app/actions/invoices"

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10

const METHOD_CONFIG: Record<string, {
  label: string; icon: React.ElementType; badgeCls: string
}> = {
  CASH:         { label: "Efectivo",          icon: Banknote,        badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  TRANSFER:     { label: "Transferencia",     icon: ArrowRightLeft,  badgeCls: "bg-blue-50 text-blue-700 border-blue-100" },
  BANK_DEPOSIT: { label: "Depósito",          icon: Building2,       badgeCls: "bg-violet-50 text-violet-700 border-violet-100" },
  CHECK:        { label: "Cheque",            icon: FileText,        badgeCls: "bg-amber-50 text-amber-700 border-amber-100" },
  OTHER:        { label: "Otro",              icon: MoreHorizontal,  badgeCls: "bg-slate-100 text-slate-600 border-slate-200" },
}

const DATE_FILTERS = [
  { value: "TODAY", label: "Hoy" },
  { value: "WEEK",  label: "Esta semana" },
  { value: "MONTH", label: "Este mes" },
  { value: "ALL",   label: "Todos" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function todayISO() { return new Date().toISOString().slice(0, 16) }

function getDateCutoff(filter: string): Date | null {
  const now = new Date()
  if (filter === "TODAY") { const d = new Date(now); d.setHours(0,0,0,0); return d }
  if (filter === "WEEK")  { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
  if (filter === "MONTH") return new Date(now.getFullYear(), now.getMonth(), 1)
  return null
}

const AVATAR_PALETTE = ["bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500","bg-pink-500","bg-indigo-500","bg-emerald-500","bg-rose-500"]
function avatarColor(name: string) {
  const h = name.split("").reduce((a,c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ─── Method badge ─────────────────────────────────────────────────────────────

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

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sub, highlight }: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-4",
      highlight ? "bg-[#1a3fa0] border-blue-700" : "bg-white border-slate-100")}
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", highlight ? "text-blue-200" : "text-slate-500")}>{label}</p>
        <p className={cn("text-xl font-bold font-display tracking-tight mt-0.5", highlight ? "text-white" : "text-slate-900")}>{value}</p>
        {sub && <p className={cn("text-[11px] font-sans mt-0.5", highlight ? "text-blue-200" : "text-slate-400")}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Customer combobox ────────────────────────────────────────────────────────

function CustomerCombobox({ customers, selected, onSelect }: {
  customers: SerializedCustomer[]
  selected: SerializedCustomer | null
  onSelect: (c: SerializedCustomer | null) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const filtered = customers.filter(
    c => c.name.toLowerCase().includes(query.toLowerCase())
  )

  const INPUT = "w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"

  if (selected) {
    return (
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(selected.name))}>
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{selected.name}</p>
            <p className="text-[11px] font-sans text-blue-600 font-medium">
              Balance: {fmtRD(selected.currentBalance)}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { onSelect(null); setTimeout(() => ref.current?.focus(), 50) }}
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
        <input ref={ref} type="text" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar cliente..." className={INPUT} />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length === 0
            ? <p className="text-sm font-sans text-slate-400 text-center py-3">Sin resultados</p>
            : (
              <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                {filtered.map(c => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={() => { onSelect(c); setQuery(""); setOpen(false) }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.name))}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      </div>
                      {c.currentBalance > 0 && (
                        <span className="text-xs font-semibold text-red-600 shrink-0">{fmtRD(c.currentBalance)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── Payment form ─────────────────────────────────────────────────────────────

const INPUT_CLS = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
const LABEL_CLS = "block text-xs font-medium text-slate-600 mb-1.5"
const SELECT_CLS = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"

interface PaymentFormProps {
  customers: SerializedCustomer[]
  onSubmit:  (data: PaymentFormData) => void
  onCancel:  () => void
  isPending: boolean
  error:     string | null
}

function PaymentForm({ customers, onSubmit, onCancel, isPending, error }: PaymentFormProps) {
  const [customer,        setCustomer]        = useState<SerializedCustomer | null>(null)
  const [pendingInvoices, setPendingInvoices] = useState<SerializedInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<SerializedInvoice | null>(null)
  const [amount,          setAmount]          = useState("")

  async function handleCustomerSelect(c: SerializedCustomer | null) {
    setCustomer(c)
    setSelectedInvoice(null)
    setAmount("")
    setPendingInvoices([])
    if (c) {
      setLoadingInvoices(true)
      const invoices = await getCustomerPendingInvoices(c.id)
      setPendingInvoices(invoices)
      setLoadingInvoices(false)
    }
  }

  function handleInvoiceSelect(inv: SerializedInvoice) {
    setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)
    setAmount(inv.id === selectedInvoice?.id ? "" : inv.balanceDue.toFixed(2))
  }

  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!customer) return
    const fd = new FormData(e.currentTarget)
    onSubmit({
      customerId:    customer.id,
      invoiceId:     selectedInvoice?.id || null,
      amount:        parseFloat(amount) || 0,
      paymentMethod: fd.get("paymentMethod") as string,
      reference:     (fd.get("reference") as string) || null,
      notes:         (fd.get("notes") as string) || null,
      paymentDate:   fd.get("paymentDate") as string,
    })
  }

  const maxAmount   = selectedInvoice?.balanceDue ?? Infinity
  const amountNum   = parseFloat(amount) || 0
  const amountError = selectedInvoice && amountNum > selectedInvoice.balanceDue + 0.001

  const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida"
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs font-sans text-red-700">{error}</p>
        </div>
      )}

      {/* Cliente */}
      <div>
        <label className={LABEL_CLS}>Cliente <span className="text-red-500">*</span></label>
        <CustomerCombobox customers={customers} selected={customer} onSelect={handleCustomerSelect} />
      </div>

      {/* Facturas pendientes */}
      {customer && (
        <div>
          <label className={LABEL_CLS}>
            Factura a pagar
            <span className="ml-1.5 text-slate-400 font-normal">(opcional)</span>
          </label>

          {loadingInvoices ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 font-sans">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Cargando facturas...
            </div>
          ) : pendingInvoices.length === 0 ? (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-xs font-sans text-emerald-700 font-semibold">No hay facturas pendientes para este cliente.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {pendingInvoices.map(inv => {
                const active = selectedInvoice?.id === inv.id
                return (
                  <button key={inv.id} type="button" onClick={() => handleInvoiceSelect(inv)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all",
                      active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200"
                    )}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#1a3fa0]">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500">{STATUS_LABELS[inv.status] ?? inv.status}</span>
                      </div>
                      <p className="text-[11px] font-sans text-slate-400 mt-0.5">{fmtDate(inv.issueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-700">{fmtRD(inv.total)}</p>
                      <p className="text-[11px] font-sans text-red-600 font-semibold">Pendiente: {fmtRD(inv.balanceDue)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Invoice summary */}
      {selectedInvoice && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total factura", value: fmtRD(selectedInvoice.total), cls: "text-slate-800" },
            { label: "Pagado",        value: fmtRD(selectedInvoice.amountPaid), cls: "text-emerald-600" },
            { label: "Pendiente",     value: fmtRD(selectedInvoice.balanceDue), cls: "text-red-600 font-bold" },
          ].map(r => (
            <div key={r.label} className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">{r.label}</p>
              <p className={cn("text-sm font-semibold mt-0.5", r.cls)}>{r.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Monto + Método */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>
            Monto recibido (RD$) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">RD$</span>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number" min="0.01" step="0.01"
              max={selectedInvoice ? selectedInvoice.balanceDue : undefined}
              placeholder="0.00" required
              className={cn(INPUT_CLS, "pl-12 text-right font-semibold",
                amountError && "border-red-400 ring-2 ring-red-100")}
            />
          </div>
          {amountError && (
            <p className="text-[11px] text-red-600 mt-1 font-sans">Máximo: {fmtRD(selectedInvoice!.balanceDue)}</p>
          )}
        </div>
        <div>
          <label className={LABEL_CLS}>Método de pago <span className="text-red-500">*</span></label>
          <select name="paymentMethod" required defaultValue="CASH" className={SELECT_CLS}>
            {Object.entries(METHOD_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Referencia + Fecha */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Referencia <span className="text-slate-400 font-normal">— # transferencia, cheque</span></label>
          <input name="reference" type="text" placeholder="TRF-00123" className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Fecha del cobro</label>
          <input name="paymentDate" type="datetime-local" defaultValue={todayISO()} required className={INPUT_CLS} />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className={LABEL_CLS}>Notas <span className="text-slate-400 font-normal">— opcional</span></label>
        <textarea name="notes" rows={2} placeholder="Observaciones del cobro..."
          className={cn(INPUT_CLS, "resize-none")} />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isPending || !customer || amountNum <= 0 || !!amountError}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
          {isPending ? <><RotateCcw className="w-4 h-4 animate-spin" />Registrando...</> : "Registrar cobro"}
        </button>
      </div>
    </form>
  )
}

// ─── Payment receipt ──────────────────────────────────────────────────────────

function PaymentReceipt({ result, onReset }: { result: PaymentResult; onReset: () => void }) {
  const methodLabel = METHOD_CONFIG[result.paymentMethod]?.label ?? result.paymentMethod
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900">Cobro registrado</p>
          <p className="text-xs font-sans text-slate-400">{fmtDatetime(result.paymentDate)}</p>
        </div>
        <span className="ml-auto font-mono font-bold text-[#1a3fa0] text-sm">{result.paymentNumber}</span>
      </div>

      <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
        {[
          { label: "Cliente",       value: result.customerName },
          ...(result.invoiceNumber ? [{ label: "Factura aplicada", value: result.invoiceNumber }] : []),
          { label: "Método",        value: methodLabel },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-sans text-slate-500">{r.label}</span>
            <span className="text-sm font-semibold text-slate-800">{r.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-bold text-slate-700">Monto cobrado</span>
          <span className="text-xl font-bold text-slate-900 font-display">{fmtRD(result.amount)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Registrar otro cobro
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  payments:  SerializedPayment[]
  stats:     PaymentStats
  customers: SerializedCustomer[]
}

export default function PaymentsClient({ payments, stats, customers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen]    = useState(false)
  const [formError, setFormError]    = useState<string | null>(null)
  const [receipt,   setReceipt]      = useState<PaymentResult | null>(null)
  const [search,    setSearch]       = useState("")
  const [dateFilter,setDateFilter]   = useState("ALL")
  const [page,      setPage]         = useState(1)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const cutoff = getDateCutoff(dateFilter)
  const q = search.toLowerCase().trim()
  const filtered = payments.filter(p => {
    const afterCutoff = !cutoff || new Date(p.paymentDate) >= cutoff
    const matchSearch = !q || [p.paymentNumber, p.customerName, p.invoiceNumber ?? ""]
      .some(v => v.toLowerCase().includes(q))
    return afterCutoff && matchSearch
  })

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0)

  function openModal() { setFormError(null); setReceipt(null); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setFormError(null); setReceipt(null) }

  function handleSubmit(data: PaymentFormData) {
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await createPayment(data)
        setReceipt(result)
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Error al registrar el cobro.")
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cobros</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Registra pagos y aplícalos a facturas pendientes.
            </p>
          </div>

          <div className="relative hidden xl:block w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar cobro..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
          </div>

          <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors shrink-0">
            <Bell className="w-5 h-5 text-slate-500" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">3</span>
          </button>

          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-xl px-2.5 py-2 transition-colors shrink-0">
            <div className="w-8 h-8 bg-[#1a3fa0] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-slate-800 hidden lg:block">Administrador</span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
          </button>

          <button onClick={openModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200 shrink-0">
            <Plus className="w-4 h-4" /> Registrar cobro
          </button>
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} iconBg="bg-white/20" iconColor="text-white"
            label="Cobrado hoy" value={fmtRD(stats.totalToday)} highlight
            sub="Total del día" />
          <KpiCard icon={Wallet}    iconBg="bg-emerald-50" iconColor="text-emerald-600"
            label="Cobrado este mes" value={fmtRD(stats.totalThisMonth)}
            sub="Mes en curso" />
          <KpiCard icon={Users}     iconBg="bg-amber-50"   iconColor="text-amber-500"
            label="Clientes con saldo" value={stats.customersWithBalance.toString()}
            sub="Balance pendiente > 0" />
          <KpiCard icon={Receipt}   iconBg="bg-blue-50"    iconColor="text-blue-600"
            label="Pago parcial" value={stats.partialInvoices.toString()}
            sub="Facturas con saldo" />
        </div>

        {/* ── Date filter + Search ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {DATE_FILTERS.map(f => (
              <button key={f.value} onClick={() => { setDateFilter(f.value); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                  dateFilter === f.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
                style={{ boxShadow: dateFilter === f.value ? undefined : "var(--shadow-card)" }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por cliente, factura o número..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              style={{ boxShadow: "var(--shadow-card)" }}
            />
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {payments.length === 0 ? "No hay cobros registrados" : "Sin resultados para este filtro"}
              </p>
              <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
                {payments.length === 0
                  ? "Registra el primer cobro para comenzar a gestionar las cuentas por cobrar."
                  : "Prueba cambiando el filtro de fecha o el término de búsqueda."}
              </p>
              {payments.length === 0 && (
                <button onClick={openModal}
                  className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Registrar primer cobro
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm min-w-[750px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {[
                        { h: "NÚMERO",    cls: "text-left pl-5 pr-4" },
                        { h: "CLIENTE",   cls: "text-left px-4" },
                        { h: "FACTURA",   cls: "text-left px-4" },
                        { h: "FECHA",     cls: "text-left px-4" },
                        { h: "MÉTODO",    cls: "text-left px-4" },
                        { h: "MONTO",     cls: "text-right px-4" },
                        { h: "REFERENCIA",cls: "text-left px-4" },
                        { h: "",          cls: "text-center px-5 w-12" },
                      ].map((c, i) => (
                        <th key={i} className={cn("text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-3.5", c.cls)}>
                          {c.h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="pl-5 pr-4 py-4">
                          <span className="font-mono text-[11px] font-bold text-[#1a3fa0] bg-blue-50 px-2 py-0.5 rounded-lg tracking-wider">
                            {p.paymentNumber}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800 truncate max-w-[150px]">{p.customerName}</p>
                        </td>
                        <td className="px-4 py-4">
                          {p.invoiceNumber
                            ? <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.invoiceNumber}</span>
                            : <span className="text-slate-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-slate-700">{fmtDate(p.paymentDate)}</p>
                          <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                            {new Date(p.paymentDate).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </td>
                        <td className="px-4 py-4"><MethodBadge method={p.paymentMethod} /></td>
                        <td className="px-4 py-4 text-right font-bold text-emerald-600">{fmtRD(p.amount)}</td>
                        <td className="px-4 py-4 text-slate-500 truncate max-w-[120px]">
                          {p.reference ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <Clock className="w-4 h-4 text-slate-300 mx-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-3">
                <p className="text-xs font-sans text-slate-500">
                  Mostrando{" "}
                  <span className="font-semibold text-slate-700">{(safePage-1)*ITEMS_PER_PAGE+1}</span>
                  {" "}a{" "}
                  <span className="font-semibold text-slate-700">{Math.min(safePage*ITEMS_PER_PAGE, filtered.length)}</span>
                  {" "}de{" "}
                  <span className="font-semibold text-slate-700">{filtered.length}</span> cobros
                </p>
                <div className="flex items-center gap-3 text-xs font-sans">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Total filtrado:</span>
                  <span className="font-bold text-emerald-600">{fmtRD(filteredTotal)}</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage===1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
                      <button key={n} onClick={() => setPage(n)}
                        className={cn("w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                          n===safePage?"bg-blue-600 text-white":"border border-slate-200 text-slate-600 hover:bg-slate-100")}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={safePage===totalPages}
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {receipt ? "Cobro registrado" : "Registrar cobro"}
                </h2>
                <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                  {receipt ? "El saldo del cliente y la factura han sido actualizados." : "Selecciona el cliente y la factura a pagar."}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              {receipt
                ? <PaymentReceipt result={receipt} onReset={() => { setReceipt(null); setFormError(null) }} />
                : <PaymentForm customers={customers} onSubmit={handleSubmit} onCancel={closeModal} isPending={isPending} error={formError} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
