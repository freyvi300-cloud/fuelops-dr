"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter }               from "next/navigation"
import {
  Receipt, Bell, ChevronDown, Search, DollarSign,
  Clock, AlertCircle, CheckCircle2, X, Eye,
  ChevronLeft, ChevronRight, Printer, Mail,
  FileDown, MessageCircle, QrCode, Droplets, Calendar, Filter,
  MoreVertical, Ban, Loader2,
} from "lucide-react"
import { cn }             from "@/lib/utils"
import type { SerializedInvoice, SerializedInvoiceDetail, InvoiceStats } from "@/app/actions/invoices"
import { getInvoiceById, cancelInvoice } from "@/app/actions/invoices"

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8

const STATUS_CONFIG: Record<string, {
  label: string; badgeCls: string; dotCls: string; filterCls: string
}> = {
  PENDING:          { label: "Pendiente",          badgeCls: "bg-amber-50 text-amber-700 border-amber-100",   dotCls: "bg-amber-500",   filterCls: "text-amber-700 bg-amber-50 border-amber-200" },
  PARTIALLY_PAID:   { label: "Pago parcial",       badgeCls: "bg-blue-50 text-blue-700 border-blue-100",     dotCls: "bg-blue-500",    filterCls: "text-blue-700 bg-blue-50 border-blue-200" },
  PAID:             { label: "Pagada",              badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-100", dotCls: "bg-emerald-500", filterCls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  OVERDUE:          { label: "Vencida",             badgeCls: "bg-red-50 text-red-700 border-red-100",       dotCls: "bg-red-500",     filterCls: "text-red-700 bg-red-50 border-red-200" },
  CANCELLED:        { label: "Cancelada",           badgeCls: "bg-slate-100 text-slate-500 border-slate-200", dotCls: "bg-slate-400",  filterCls: "text-slate-600 bg-slate-100 border-slate-200" },
}

const FILTER_OPTIONS = [
  { value: "ALL",            label: "Todas"            },
  { value: "PENDING",        label: "Pendientes"       },
  { value: "PARTIALLY_PAID", label: "Pago parcial"     },
  { value: "PAID",           label: "Pagadas"          },
  { value: "OVERDUE",        label: "Vencidas"         },
  { value: "CANCELLED",      label: "Canceladas"       },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Print invoice ────────────────────────────────────────────────────────────
// Opens a browser-print-ready HTML page in a new tab.
// Works for both active and CANCELLED invoices (shows FACTURA CANCELADA banner).
// No PDF library required — uses the browser's native print dialog.

function printInvoice(d: SerializedInvoiceDetail) {
  const isCancelled = d.status === "CANCELLED"
  const fmtN  = (n: number, dec = 2) => `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
  const fmtL  = (iso: string) => new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })
  const fmtDT = (iso: string) => new Date(iso).toLocaleString("es-DO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const cancelledBanner = isCancelled ? `
    <div class="cancelled-banner">
      <div class="cancelled-title">&#9940; FACTURA CANCELADA</div>
      ${d.cancelledAt   ? `<p>Cancelada el ${fmtDT(d.cancelledAt)}${d.cancelledByName ? ` por <strong>${d.cancelledByName}</strong>` : ""}</p>` : ""}
      ${d.cancellationReason ? `<p><strong>Motivo:</strong> ${d.cancellationReason}</p>` : ""}
    </div>` : ""

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${d.invoiceNumber}${isCancelled ? " — CANCELADA" : ""}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1e293b;padding:32px;max-width:780px;margin:0 auto}
  .print-btn{position:fixed;top:16px;right:16px;background:#1a3fa0;color:white;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer}
  @media print{.print-btn{display:none}body{padding:16px}}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1a3fa0}
  .co-name{font-size:17px;font-weight:bold;color:#1a3fa0}.co-sub{font-size:11px;color:#64748b;margin-top:3px}
  .inv-num{font-size:22px;font-weight:bold;color:#1a3fa0;text-align:right}.inv-label{font-size:11px;color:#64748b;text-align:right;margin-top:3px}
  .cancelled-banner{background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:14px 20px;margin-bottom:20px;text-align:center}
  .cancelled-title{color:#dc2626;font-size:18px;font-weight:bold;letter-spacing:3px;margin-bottom:6px}
  .cancelled-banner p{color:#7f1d1d;font-size:11px;margin-top:3px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
  .box{background:#f8fafc;border-radius:6px;padding:12px}
  .box-lbl{font-size:10px;font-weight:bold;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  thead th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;font-weight:bold}
  tbody td{padding:10px;border-bottom:1px solid #f1f5f9}
  .tr{text-align:right}
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:20px}
  .totals{width:260px}
  .tot-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .tot-grand{font-weight:bold;font-size:15px;border-top:2px solid #1a3fa0;border-bottom:none;padding-top:10px}
  .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:14px;text-align:center;color:#94a3b8;font-size:10px}
  .truck-box{display:flex;align-items:center;gap:12px;background:#f8fafc;border-radius:6px;padding:10px 14px;margin-bottom:18px}
  .truck-code{background:#1a3fa0;color:white;font-family:monospace;font-weight:bold;padding:4px 10px;border-radius:6px;font-size:11px;letter-spacing:1px}
  .notes-box{background:#f8fafc;border-radius:6px;padding:12px;margin-bottom:18px}
  .notes-lbl{font-size:10px;font-weight:bold;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
</style></head><body>
<button class="print-btn" onclick="window.print()">&#128438; Imprimir</button>
${cancelledBanner}
<div class="header">
  <div><div class="co-name">LBP Inversiones y Servicios S.R.L.</div><div class="co-sub">Distribución de Diésel</div></div>
  <div><div class="inv-num">${d.invoiceNumber}</div><div class="inv-label">FACTURA${isCancelled ? " (CANCELADA)" : ""}</div></div>
</div>
<div class="grid2">
  <div class="box"><div class="box-lbl">Fecha de emisión</div><strong>${fmtL(d.issueDate)}</strong></div>
  <div class="box"><div class="box-lbl">Fecha de vencimiento</div><strong>${d.dueDate ? fmtL(d.dueDate) : "Contado (pago al instante)"}</strong></div>
</div>
<div class="grid2">
  <div class="box"><div class="box-lbl">De</div><strong>LBP Inversiones y Servicios S.R.L.</strong><br>Empresa de Distribución de Diésel</div>
  <div class="box"><div class="box-lbl">Para</div><strong>${d.customerName}</strong>${d.customerPhone ? `<br>${d.customerPhone}` : ""}${d.customerEmail ? `<br>${d.customerEmail}` : ""}${d.customerRnc ? `<br>RNC: ${d.customerRnc}` : ""}${d.customerAddress ? `<br>${d.customerAddress}` : ""}</div>
</div>
${d.truckCode ? `<div class="truck-box"><span class="truck-code">${d.truckCode}</span><span><strong>${d.truckName}</strong>${d.truckPlate ? ` · Placa: ${d.truckPlate}` : ""}</span></div>` : ""}
<table>
  <thead><tr><th>Descripción</th><th class="tr">Cantidad</th><th class="tr">Precio/Gal</th><th class="tr">Importe</th></tr></thead>
  <tbody>
    <tr>
      <td>Diésel — suministro<br><span style="color:#94a3b8;font-size:10px">${d.paymentType === "CREDIT" ? "Crédito" : "Contado"}</span></td>
      <td class="tr">${d.gallons.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal</td>
      <td class="tr">${fmtN(d.pricePerGallon, 4)}</td>
      <td class="tr"><strong>${fmtN(d.subtotal)}</strong></td>
    </tr>
  </tbody>
</table>
<div class="totals-wrap"><div class="totals">
  <div class="tot-row"><span>Subtotal</span><span>${fmtN(d.subtotal)}</span></div>
  <div class="tot-row"><span>ITBIS</span><span>${fmtN(d.tax)}</span></div>
  <div class="tot-row"><span>Descuento</span><span>−${fmtN(d.discount)}</span></div>
  <div class="tot-row tot-grand"><span>Total</span><span>${fmtN(d.total)}</span></div>
  <div class="tot-row" style="border-bottom:none"><span>Monto pagado</span><span style="color:#16a34a">${fmtN(d.amountPaid)}</span></div>
  <div class="tot-row" style="border-bottom:none;font-weight:bold"><span>Balance pendiente</span><span style="color:${d.balanceDue > 0 ? "#dc2626" : "#16a34a"}">${fmtN(d.balanceDue)}</span></div>
</div></div>
${(d.notes || d.supplyNotes) ? `<div class="notes-box"><div class="notes-lbl">Notas</div>${d.notes ? `<p>${d.notes}</p>` : ""}${d.supplyNotes ? `<p style="color:#64748b;margin-top:4px">${d.supplyNotes}</p>` : ""}</div>` : ""}
<div class="footer">LBP Inversiones y Servicios S.R.L. &nbsp;·&nbsp; Generado el ${fmtDT(new Date().toISOString())}</div>
</body></html>`

  const win = window.open("", "_blank", "width=860,height=900")
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.badgeCls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotCls)} />
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

// ─── Row actions menu ─────────────────────────────────────────────────────────

function RowActionsMenu({
  inv,
  onViewDetail,
  onCancel,
  onPrint,
  isLoadingDetail,
  isPrinting,
}: {
  inv: SerializedInvoice
  onViewDetail: () => void
  onCancel: () => void
  onPrint: () => void
  isLoadingDetail: boolean
  isPrinting: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const canCancel = inv.status !== "CANCELLED" && inv.status !== "PAID"

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <button
        onClick={onViewDetail}
        disabled={isLoadingDetail || isPrinting}
        title="Ver detalle"
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoadingDetail
          ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          : <Eye className="w-4 h-4" />
        }
      </button>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={isLoadingDetail || isPrinting}
        title="Más acciones"
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPrinting
          ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          : <MoreVertical className="w-4 h-4" />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30">
          <button
            onClick={() => { setOpen(false); onPrint() }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0 text-slate-400" />
            Imprimir / PDF
          </button>
          <div className="my-1 border-t border-slate-100" />
          {/* Edición: pendiente de implementar con validaciones seguras (Fase 6) */}
          <button
            onClick={() => { setOpen(false); onCancel() }}
            disabled={!canCancel}
            className={cn(
              "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors",
              canCancel
                ? "text-red-600 hover:bg-red-50 cursor-pointer"
                : "text-slate-300 cursor-not-allowed",
            )}
          >
            <Ban className="w-4 h-4 shrink-0" />
            Cancelar factura
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Cancel confirmation modal ────────────────────────────────────────────────

function CancelModal({
  inv,
  onClose,
  onSuccess,
}: {
  inv: SerializedInvoice
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason,  setReason]  = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    setLoading(true)
    const result = await cancelInvoice(inv.id, reason)
    setLoading(false)
    if (!result.ok) { setError(result.error); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Cancelar factura</p>
              <p className="text-xs text-slate-500 font-sans mt-0.5">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Invoice summary */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-slate-500">Factura</span>
              <span className="font-mono text-xs font-bold text-[#1a3fa0]">{inv.invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-slate-500">Cliente</span>
              <span className="text-sm font-semibold text-slate-800">{inv.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-slate-500">Total</span>
              <span className="text-sm font-bold text-slate-900">{fmtRD(inv.total)}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-sans text-amber-700 leading-relaxed">
              Al cancelar esta factura su estado cambiará a <strong>Cancelada</strong> y quedará excluida de todos los reportes y cobros. El suministro asociado permanecerá registrado.
            </p>
          </div>

          {/* Reason textarea */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Motivo de cancelación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Describe el motivo de la cancelación (mínimo 10 caracteres)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all resize-none"
            />
            <p className="text-[11px] font-sans text-slate-400">{reason.trim().length}/10 caracteres mínimo</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-sans text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Mantener factura
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || reason.trim().length < 10}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelando…</> : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice detail modal ─────────────────────────────────────────────────────

function InvoiceDetailModal({
  detail, onClose,
}: {
  detail: SerializedInvoiceDetail
  onClose: () => void
}) {
  const cfg = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.PENDING

  const STUB_ACTIONS = [
    { icon: Mail,          label: "Enviar por email",  hint: "Próximamente" },
    { icon: MessageCircle, label: "WhatsApp",         hint: "Próximamente" },
    { icon: QrCode,        label: "Código QR",        hint: "Fase 6" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-2xl max-h-[95vh] overflow-y-auto">

        {/* ── Modal header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 tracking-tight text-lg font-display">{detail.invoiceNumber}</p>
              <StatusBadge status={detail.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Actions bar ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Imprimir / PDF — functional */}
            <button
              onClick={() => printInvoice(detail)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold font-sans transition-all hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / PDF
            </button>
            {/* Stub actions — pending implementation */}
            {STUB_ACTIONS.map(a => {
              const Icon = a.icon
              return (
                <button key={a.label} disabled title={a.hint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-400 text-xs font-semibold font-sans cursor-not-allowed opacity-60 transition-all hover:border-blue-200">
                  <Icon className="w-3.5 h-3.5" />
                  {a.label}
                  <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full ml-0.5">{a.hint}</span>
                </button>
              )
            })}
          </div>

          {/* ── Dates ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1">Fecha de emisión</p>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(detail.issueDate)}</p>
            </div>
            <div className={cn("rounded-xl px-4 py-3",
              detail.status === "OVERDUE" ? "bg-red-50" : "bg-slate-50")}>
              <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1">Fecha de vencimiento</p>
              <p className={cn("text-sm font-semibold",
                detail.status === "OVERDUE" ? "text-red-700" : "text-slate-800")}>
                {detail.dueDate ? fmtDate(detail.dueDate) : "Contado (pagada al instante)"}
              </p>
            </div>
          </div>

          {/* ── Parties ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* From */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">De</p>
              <p className="font-bold text-slate-800 text-sm">Empresa de Distribución de Diésel</p>
              <p className="text-[11px] font-sans text-slate-400 mt-0.5">LBP Inversiones y Servicios S.R.L.</p>
              {/* TODO: populate from SystemSettings model (Phase 2) */}
            </div>
            {/* To */}
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-[10px] font-sans font-semibold text-blue-400 uppercase tracking-wider mb-2">Para</p>
              <p className="font-bold text-slate-800 text-sm">{detail.customerName}</p>
              {detail.customerPhone  && <p className="text-[11px] font-sans text-slate-500 mt-0.5">{detail.customerPhone}</p>}
              {detail.customerEmail  && <p className="text-[11px] font-sans text-slate-500">{detail.customerEmail}</p>}
              {detail.customerRnc    && <p className="text-[11px] font-sans text-slate-500">RNC: {detail.customerRnc}</p>}
              {detail.customerAddress && <p className="text-[11px] font-sans text-slate-500">{detail.customerAddress}</p>}
            </div>
          </div>

          {/* ── Truck ─────────────────────────────────────────────────────── */}
          {detail.truckCode && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="inline-block bg-[#1a3fa0] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-widest font-mono shrink-0">
                {detail.truckCode}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{detail.truckName}</p>
                {detail.truckPlate && <p className="text-[11px] font-sans text-slate-400">Placa: {detail.truckPlate}</p>}
              </div>
            </div>
          )}

          {/* ── Supply line items ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-50/70 px-4 py-2.5 border-b border-slate-100">
              <div className="grid grid-cols-12 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span className="col-span-5">Descripción</span>
                <span className="col-span-2 text-right">Cantidad</span>
                <span className="col-span-2 text-right">Precio</span>
                <span className="col-span-3 text-right">Importe</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="grid grid-cols-12 text-sm">
                <div className="col-span-5">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Diésel — suministro</p>
                  <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                    {detail.paymentType === "CREDIT" ? "Crédito" : "Contado"}
                  </p>
                </div>
                <p className="col-span-2 text-right font-sans text-slate-600">
                  {detail.gallons.toLocaleString("es-DO", { minimumFractionDigits: 2 })} gal
                </p>
                <p className="col-span-2 text-right font-sans text-slate-600">{fmtRD(detail.pricePerGallon)}</p>
                <p className="col-span-3 text-right font-semibold text-slate-800">{fmtRD(detail.subtotal)}</p>
              </div>
            </div>
          </div>

          {/* ── Financial summary ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
            {[
              { label: "Subtotal",  value: fmtRD(detail.subtotal),  cls: "text-slate-700" },
              { label: "ITBIS (0%)", value: fmtRD(detail.tax),      cls: "text-slate-500", note: "— pendiente de configurar" },
              { label: "Descuento", value: `−${fmtRD(detail.discount)}`, cls: "text-slate-500" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-sans text-slate-500">
                  {row.label}
                  {row.note && <span className="text-slate-400 ml-1">{row.note}</span>}
                </span>
                <span className={cn("text-sm font-medium", row.cls)}>{row.value}</span>
              </div>
            ))}
            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
              <span className="text-sm font-bold text-slate-800">Total</span>
              <span className="text-xl font-bold text-slate-900 font-display">{fmtRD(detail.total)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs font-sans text-slate-500">Monto pagado</span>
              <span className="text-sm font-semibold text-emerald-600">{fmtRD(detail.amountPaid)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-slate-700">Balance pendiente</span>
              <span className={cn("text-lg font-bold font-display",
                detail.balanceDue > 0 ? "text-red-600" : "text-emerald-600")}>
                {fmtRD(detail.balanceDue)}
              </span>
            </div>
          </div>

          {/* ── Meter photo ────────────────────────────────────────────────── */}
          {detail.meterPhotoB64 && (
            <div>
              <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" />
                Foto del medidor
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.meterPhotoB64} alt="Foto del medidor" className="w-full max-h-64 object-cover rounded-xl border border-slate-200" />
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          {(detail.notes || detail.supplyNotes) && (
            <div className="px-4 py-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notas</p>
              {detail.notes && <p className="text-xs font-sans text-slate-600">{detail.notes}</p>}
              {detail.supplyNotes && <p className="text-xs font-sans text-slate-500 mt-1">{detail.supplyNotes}</p>}
            </div>
          )}

          {/* ── Cancellation info ─────────────────────────────────────────── */}
          {detail.status === "CANCELLED" && detail.cancelledAt && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <p className="text-[10px] font-sans font-semibold text-red-500 uppercase tracking-wider">Factura cancelada</p>
              </div>
              <p className="text-xs font-sans text-red-700 mb-1">
                <span className="font-semibold">Fecha:</span>{" "}
                {new Date(detail.cancelledAt).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {detail.cancelledByName && (
                <p className="text-xs font-sans text-red-700 mb-1">
                  <span className="font-semibold">Cancelado por:</span> {detail.cancelledByName}
                </p>
              )}
              {detail.cancellationReason && (
                <p className="text-xs font-sans text-red-700">
                  <span className="font-semibold">Motivo:</span> {detail.cancellationReason}
                </p>
              )}
            </div>
          )}

          {/* ── Payment history ───────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de pagos</p>
            {detail.payments.length === 0 ? (
              <div className="px-4 py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-sans text-slate-400">No hay pagos registrados para esta factura.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
                {detail.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#1a3fa0]">{p.paymentNumber}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500">{p.paymentMethod.replace("_", " ")}</span>
                      </div>
                      <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                        {new Date(p.paymentDate).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">+{fmtRD(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  invoices:       SerializedInvoice[]
  stats:          InvoiceStats
  initialSearch:  string
  initialStatus:  string
  customers?:     { id: string; name: string }[]
}

export default function InvoicesClient({ invoices, stats, initialSearch, initialStatus, customers = [] }: Props) {
  const router  = useRouter()
  const [, startTransition] = useTransition()

  const [search,      setSearch]      = useState(initialSearch)
  const [statusFilter,setStatusFilter]= useState(initialStatus)
  const [dateFrom,    setDateFrom]    = useState("")
  const [dateTo,      setDateTo]      = useState("")
  const [custId,      setCustId]      = useState("")
  const [page,        setPage]        = useState(1)
  const [detail,       setDetail]       = useState<SerializedInvoiceDetail | null>(null)
  const [loadingId,    setLoadingId]    = useState<string | null>(null)
  const [printingId,   setPrintingId]   = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SerializedInvoice | null>(null)

  // ── Client-side filter ─────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filtered = invoices.filter(inv => {
    const matchSearch = !q || [inv.invoiceNumber, inv.customerName, inv.truckCode ?? ""]
      .some(v => v.toLowerCase().includes(q))
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter
    const d = new Date(inv.issueDate)
    const afterFrom = !dateFrom || d >= new Date(dateFrom + "T00:00:00")
    const beforeTo  = !dateTo   || d <= new Date(dateTo   + "T23:59:59")
    const matchCust = !custId || inv.customerId === custId
    return matchSearch && matchStatus && afterFrom && beforeTo && matchCust
  })

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // ── Totals — CANCELLED invoices are excluded (write-offs, not active receivables)
  const filteredTotal   = filtered.reduce((s, i) => i.status === "CANCELLED" ? s : s + i.total,      0)
  const filteredPending = filtered.reduce((s, i) => i.status === "CANCELLED" ? s : s + i.balanceDue, 0)

  async function openDetail(id: string) {
    setLoadingId(id)
    const data = await getInvoiceById(id)
    setDetail(data)
    setLoadingId(null)
  }

  async function handlePrint(inv: SerializedInvoice) {
    setPrintingId(inv.id)
    const data = await getInvoiceById(inv.id)
    setPrintingId(null)
    if (data) printInvoice(data)
  }

  function handleStatusFilter(s: string) {
    setStatusFilter(s)
    setPage(1)
    startTransition(() => {
      const params = new URLSearchParams()
      if (search)         params.set("q", search)
      if (s !== "ALL")    params.set("status", s)
      router.replace(`/facturas${params.size ? `?${params}` : ""}`)
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-4 sm:px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Facturas</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                Auto-generadas
              </span>
            </div>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Generadas automáticamente al confirmar cada suministro.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative hidden xl:block w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar factura..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
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
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} iconBg="bg-white/20"    iconColor="text-white"
            label="Total facturado" value={fmtRD(stats.totalBilled)}
            sub="Todas las facturas activas" highlight />
          <KpiCard icon={Clock}       iconBg="bg-amber-50"   iconColor="text-amber-500"
            label="Pendiente por cobrar" value={fmtRD(stats.totalPending)}
            sub="Balance abierto total" />
          <KpiCard icon={Receipt}     iconBg="bg-blue-50"    iconColor="text-blue-600"
            label="Facturas pendientes" value={stats.countPending.toString()}
            sub="Awaiting payment" />
          <KpiCard icon={AlertCircle} iconBg="bg-red-50"     iconColor="text-red-500"
            label="Facturas vencidas" value={stats.countOverdue.toString()}
            sub={stats.countOverdue > 0 ? "Requieren atención" : "Al día"} />
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 space-y-3"
          style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Row 1: search + dates + customer */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="N° factura, cliente..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
            <span className="text-slate-400 text-xs shrink-0">—</span>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            {customers.length > 0 && (
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select value={custId} onChange={e => { setCustId(e.target.value); setPage(1) }}
                  className="pl-8 pr-7 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all appearance-none cursor-pointer">
                  <option value="">Todos los clientes</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}

            {(dateFrom || dateTo || custId) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setCustId(""); setPage(1) }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {/* Row 2: status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => handleStatusFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}>
                {opt.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Receipt className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {invoices.length === 0 ? "No hay facturas todavía" : "Sin resultados para este filtro"}
              </p>
              <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
                {invoices.length === 0
                  ? "Las facturas se generan automáticamente al confirmar suministros."
                  : "Prueba cambiando el filtro o el término de búsqueda."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm min-w-[780px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/80">
                      {[
                        { h: "NÚMERO",    cls: "text-left pl-5 pr-4" },
                        { h: "CLIENTE",   cls: "text-left px-4" },
                        { h: "EQUIPO",    cls: "text-left px-4" },
                        { h: "FECHA",     cls: "text-left px-4" },
                        { h: "ESTADO",    cls: "text-center px-4" },
                        { h: "TOTAL",     cls: "text-right px-4" },
                        { h: "PENDIENTE", cls: "text-right px-4" },
                        { h: "ACCIONES",  cls: "text-center px-5 w-20" },
                      ].map(col => (
                        <th key={col.h} className={cn("text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3.5", col.cls)}>
                          {col.h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Número */}
                        <td className="pl-5 pr-4 py-4">
                          <span className="font-mono text-xs font-bold text-[#1a3fa0] bg-blue-50 px-2.5 py-1 rounded-lg tracking-wider">
                            {inv.invoiceNumber}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">{inv.customerName}</p>
                          {inv.customerPhone && <p className="text-[11px] text-slate-400 mt-0.5">{inv.customerPhone}</p>}
                        </td>

                        {/* Equipo */}
                        <td className="px-4 py-4">
                          {inv.truckCode
                            ? <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{inv.truckCode}</span>
                            : <span className="text-slate-300 text-xs">—</span>
                          }
                        </td>

                        {/* Fecha */}
                        <td className="px-4 py-4">
                          <p className="text-slate-700">{fmtDate(inv.issueDate)}</p>
                          {inv.dueDate && (
                            <p className={cn("text-[11px] font-sans mt-0.5",
                              inv.status === "OVERDUE" ? "text-red-500 font-semibold" : "text-slate-400")}>
                              Vence: {fmtDate(inv.dueDate)}
                            </p>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={inv.status} />
                        </td>

                        {/* Total */}
                        <td className="px-4 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">
                          {fmtRD(inv.total)}
                        </td>

                        {/* Pendiente */}
                        <td className="px-4 py-4 text-right">
                          <span className={cn("font-bold", inv.balanceDue > 0 ? "text-red-600" : "text-emerald-600")}>
                            {fmtRD(inv.balanceDue)}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-4 text-center">
                          <RowActionsMenu
                            inv={inv}
                            onViewDetail={() => openDetail(inv.id)}
                            onCancel={() => setCancelTarget(inv)}
                            onPrint={() => handlePrint(inv)}
                            isLoadingDetail={loadingId === inv.id}
                            isPrinting={printingId === inv.id}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex-wrap gap-3">
                <p className="text-xs font-sans text-slate-500">
                  Mostrando{" "}
                  <span className="font-semibold text-slate-700">{(safePage - 1) * ITEMS_PER_PAGE + 1}</span>
                  {" "}a{" "}
                  <span className="font-semibold text-slate-700">{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span>
                  {" "}de{" "}
                  <span className="font-semibold text-slate-700">{filtered.length}</span> facturas
                </p>

                <div className="flex items-center gap-4 text-xs font-sans">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Totales:</span>
                  <span className="font-bold text-slate-800">{fmtRD(filteredTotal)}</span>
                  <span className="font-bold text-red-600">{fmtRD(filteredPending)} pendiente</span>
                </div>

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

        {/* Auto-gen notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs font-sans text-blue-700 leading-relaxed">
            <span className="font-bold">Facturación automática:</span>{" "}
            Cada suministro confirmado genera su factura instantáneamente.
            Pagos en contado se marcan como <strong>Pagadas</strong> automáticamente.
            Ventas a crédito quedan como <strong>Pendientes</strong> con 30 días de plazo.
          </p>
        </div>
      </div>

      {/* ══ DETAIL MODAL ══════════════════════════════════════════════════════ */}
      {detail && <InvoiceDetailModal detail={detail} onClose={() => setDetail(null)} />}

      {/* ══ CANCEL MODAL ══════════════════════════════════════════════════════ */}
      {cancelTarget && (
        <CancelModal
          inv={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => {
            setCancelTarget(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
