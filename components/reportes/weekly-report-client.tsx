"use client"

import { useState, useRef } from "react"
import {
  Users, Download, FileSpreadsheet, ImageIcon, Archive,
  Loader2, AlertCircle, FileText, Fuel, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getWeeklyReportData,
  type WeeklyReportResult,
  type WeeklyCustomerReport,
} from "@/app/actions/weekly-report"

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", timeZone: "UTC",
  })
}

function fmtRD(n: number): string {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Export: PDF ──────────────────────────────────────────────────────────────

async function buildPDFDoc(
  report: WeeklyCustomerReport,
  meta:   WeeklyReportResult,
): Promise<InstanceType<typeof import("jspdf").jsPDF>> {
  const { jsPDF }              = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const GREEN:       [number, number, number] = [22, 163, 74]
  const GREEN_LIGHT: [number, number, number] = [240, 253, 244]
  const GREEN_DARK:  [number, number, number] = [22, 101, 52]

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageW, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("REPORTE DE CONSUMO", pageW / 2, 13, { align: "center" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(meta.businessName.toUpperCase(), pageW / 2, 21, { align: "center" })

  if (meta.weekNumber) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text(`Semana #${meta.weekNumber}`, pageW - 14, 13, { align: "right" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.text(new Date(meta.dateFrom).getUTCFullYear().toString(), pageW - 14, 19, { align: "right" })
  }

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Período: ${meta.periodLabel}`, pageW / 2, 30, { align: "center" })

  // ── Client info ────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  const infoY = 50
  const pairs: [string, string][] = [["Cliente:", report.customer.name]]
  if (report.customer.rnc)   pairs.push(["RNC:",       report.customer.rnc])
  if (report.customer.phone) pairs.push(["Teléfono:",  report.customer.phone])

  pairs.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold").setFontSize(9)
    doc.text(label, 15, infoY + i * 7)
    doc.setFont("helvetica", "normal")
    doc.text(value, 40, infoY + i * 7)
  })

  // ── Table ──────────────────────────────────────────────────────────────
  const tableY = infoY + pairs.length * 7 + 8
  autoTable(doc, {
    startY: tableY,
    head:   [["Fecha", "Rótulo", "Camión", "Galones", "Precio/Gal", "Total RD$", "Factura"]],
    body:   report.supplies.map(s => [
      fmtDate(s.date),
      s.truckCode  ?? "—",
      s.truckName  ?? "—",
      s.gallons.toFixed(2) + " gal",
      fmtRD(s.pricePerGallon),
      fmtRD(s.total),
      s.invoiceNumber ?? "—",
    ]),
    theme: "striped",
    headStyles:         { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles:         { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: GREEN_LIGHT },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
  })

  const afterTable: number = (doc as any).lastAutoTable?.finalY ?? tableY + 40

  // ── Totals box ─────────────────────────────────────────────────────────
  const totY = afterTable + 6
  doc.setFillColor(...GREEN_LIGHT)
  doc.rect(14, totY, pageW - 28, 26, "F")
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.rect(14, totY, pageW - 28, 26, "S")

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...GREEN_DARK)
  doc.text(`Total galones:   ${report.totals.totalGallons.toFixed(2)} gal`, 20, totY + 9)
  doc.text(`Total facturado: ${fmtRD(report.totals.totalBilled)}`,          20, totY + 17)
  doc.setTextColor(185, 28, 28)
  doc.text(`Balance pendiente: ${fmtRD(report.totals.balanceDue)}`, pageW - 20, totY + 13, { align: "right" })

  // ── Note ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(100, 116, 139)
  doc.text(
    "Este reporte refleja el combustible consumido en el período seleccionado.",
    pageW / 2, totY + 38, { align: "center" },
  )

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.rect(0, pageH - 14, pageW, 14, "F")
  doc.setDrawColor(226, 232, 240).setLineWidth(0.3).line(0, pageH - 14, pageW, pageH - 14)
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(148, 163, 184)
  const genDate = new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`Generado: ${genDate}`, 14, pageH - 5)
  doc.text(meta.businessName, pageW / 2, pageH - 5, { align: "center" })
  if (meta.businessPhone) doc.text(meta.businessPhone, pageW - 14, pageH - 5, { align: "right" })

  return doc
}

function pdfFilename(report: WeeklyCustomerReport, meta: WeeklyReportResult): string {
  const slug = report.customer.name.replace(/\s+/g, "_")
  const from = meta.dateFrom.slice(0, 10)
  const to   = meta.dateTo.slice(0, 10)
  return `Reporte_${slug}_${from}_${to}.pdf`
}

async function downloadPDF(report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const doc = await buildPDFDoc(report, meta)
  doc.save(pdfFilename(report, meta))
}

// ─── Export: Excel ────────────────────────────────────────────────────────────

async function buildExcelBuffer(
  report: WeeklyCustomerReport,
  meta:   WeeklyReportResult,
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx")

  const rows: (string | number | null)[][] = [
    ["REPORTE DE CONSUMO"],
    [meta.businessName],
    [],
    ["Cliente:", report.customer.name],
    ["Período:", meta.periodLabel],
    ...(meta.weekNumber ? [["Semana:", `#${meta.weekNumber}`]] : []),
    ...(report.customer.rnc   ? [["RNC:",      report.customer.rnc]]   : []),
    ...(report.customer.phone ? [["Teléfono:", report.customer.phone]] : []),
    [],
    ["Fecha", "Rótulo", "Camión", "Galones", "Precio/Gal (RD$)", "Total (RD$)", "Factura", "Tipo de Pago"],
    ...report.supplies.map(s => [
      new Date(s.date).toLocaleDateString("es-DO", { timeZone: "UTC" }),
      s.truckCode  ?? "—",
      s.truckName  ?? "—",
      Number(s.gallons),
      Number(s.pricePerGallon),
      Number(s.total),
      s.invoiceNumber ?? "—",
      s.paymentType === "CASH" ? "Efectivo" : "Crédito",
    ]),
    [],
    ["TOTALES", "", "", report.totals.totalGallons, "", report.totals.totalBilled],
    ["Balance pendiente (RD$):", "", "", "", "", report.totals.balanceDue],
    [],
    ["Este reporte refleja el combustible consumido en el período seleccionado."],
    [`Generado: ${new Date().toLocaleDateString("es-DO")}`],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 12 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Reporte")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

function xlsxFilename(report: WeeklyCustomerReport, meta: WeeklyReportResult): string {
  const slug = report.customer.name.replace(/\s+/g, "_")
  const from = meta.dateFrom.slice(0, 10)
  const to   = meta.dateTo.slice(0, 10)
  return `Reporte_${slug}_${from}_${to}.xlsx`
}

async function downloadExcel(report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const buffer = await buildExcelBuffer(report, meta)
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const a      = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: xlsxFilename(report, meta) })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Export: PNG ──────────────────────────────────────────────────────────────

async function downloadPNG(el: HTMLDivElement, report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" })
  const slug   = report.customer.name.replace(/\s+/g, "_")
  const a      = Object.assign(document.createElement("a"), {
    href:     canvas.toDataURL("image/png"),
    download: `Reporte_${slug}_${meta.dateFrom.slice(0, 10)}_${meta.dateTo.slice(0, 10)}.png`,
  })
  a.click()
}

// ─── Export: ZIP ──────────────────────────────────────────────────────────────

async function downloadAllZip(meta: WeeklyReportResult) {
  const { default: JSZip } = await import("jszip")
  const zip    = new JSZip()
  const pdfs   = zip.folder("PDFs")!
  const excels = zip.folder("Excel")!

  for (const report of meta.reports) {
    const [pdfDoc, xlsBuf] = await Promise.all([
      buildPDFDoc(report, meta),
      buildExcelBuffer(report, meta),
    ])
    pdfs.file(pdfFilename(report, meta),   pdfDoc.output("arraybuffer"))
    excels.file(xlsxFilename(report, meta), xlsBuf)
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const from = meta.dateFrom.slice(0, 10)
  const to   = meta.dateTo.slice(0, 10)
  const a    = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(blob),
    download: `Reportes_${from}_${to}.zip`,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Report Preview Card ──────────────────────────────────────────────────────

function ReportPreviewCard({
  report, meta, previewRef,
}: {
  report:     WeeklyCustomerReport
  meta:       WeeklyReportResult
  previewRef: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={previewRef}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-green-600 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-green-100 text-[10px] font-semibold tracking-widest uppercase">
            {meta.businessName}
          </p>
          <h2 className="text-white text-lg font-extrabold tracking-tight mt-0.5">
            Reporte de Consumo
          </h2>
          <p className="text-green-100 text-xs mt-1">Período: {meta.periodLabel}</p>
        </div>
        {meta.weekNumber && (
          <div className="bg-white/20 rounded-xl px-3 py-2 text-right shrink-0">
            <p className="text-green-100 text-[9px] font-semibold uppercase tracking-wide">Semana</p>
            <p className="text-white text-2xl font-extrabold leading-none">#{meta.weekNumber}</p>
          </div>
        )}
      </div>

      {/* Client info strip */}
      <div className="bg-green-50 border-b border-green-100 px-6 py-3 flex flex-wrap gap-x-8 gap-y-1">
        <div>
          <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Cliente</span>
          <p className="text-sm font-bold text-slate-800">{report.customer.name}</p>
        </div>
        {report.customer.rnc && (
          <div>
            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">RNC</span>
            <p className="text-sm font-medium text-slate-700">{report.customer.rnc}</p>
          </div>
        )}
        {report.customer.phone && (
          <div>
            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Teléfono</span>
            <p className="text-sm font-medium text-slate-700">{report.customer.phone}</p>
          </div>
        )}
        {report.customer.address && (
          <div>
            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Dirección</span>
            <p className="text-sm font-medium text-slate-700">{report.customer.address}</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="px-6 py-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-green-600 text-white text-[11px] font-semibold uppercase tracking-wide">
              {["Fecha","Rótulo","Camión","Galones","Precio/Gal","Total RD$","Factura"].map((h, i) => (
                <th key={h} className={cn(
                  "px-3 py-2.5",
                  i === 0 ? "text-left rounded-tl-lg" : i === 6 ? "text-left rounded-tr-lg" : i >= 3 ? "text-right" : "text-left"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.supplies.map((s, i) => (
              <tr key={s.id} className={cn("border-b border-slate-100 text-xs", i % 2 === 0 ? "bg-white" : "bg-green-50/40")}>
                <td className="px-3 py-2.5 font-medium text-slate-700">{fmtDate(s.date)}</td>
                <td className="px-3 py-2.5 font-mono font-bold text-green-700">{s.truckCode ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.truckName ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{s.gallons.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right text-slate-600">{fmtRD(s.pricePerGallon)}</td>
                <td className="px-3 py-2.5 text-right font-bold text-slate-800">{fmtRD(s.total)}</td>
                <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">{s.invoiceNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mx-6 mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Total galones</p>
            <p className="text-xl font-extrabold text-green-800">{report.totals.totalGallons.toFixed(2)} gal</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Total facturado</p>
            <p className="text-xl font-extrabold text-green-800">{fmtRD(report.totals.totalBilled)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Balance pendiente</p>
          <p className="text-xl font-extrabold text-red-700">{fmtRD(report.totals.balanceDue)}</p>
        </div>
      </div>

      {/* Note + footer */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-3">
        <p className="text-[11px] text-slate-500 italic text-center">
          Este reporte refleja el combustible consumido en el período seleccionado.
        </p>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
          <span>Generado: {new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })}</span>
          <span className="font-semibold">{meta.businessName}</span>
          {meta.businessPhone && <span>{meta.businessPhone}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const INPUT_DATE = "px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 w-full"
const BTN_EXPORT = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"

// Quick-range presets
const PRESETS = [
  { label: "Esta semana",   getDates: () => { const d = new Date(); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day + 1); return [mon.toISOString().slice(0,10), d.toISOString().slice(0,10)] as [string,string] } },
  { label: "Sem. pasada",   getDates: () => { const d = new Date(); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day - 6); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return [mon.toISOString().slice(0,10), sun.toISOString().slice(0,10)] as [string,string] } },
  { label: "Este mes",      getDates: () => { const d = new Date(); const from = new Date(d.getFullYear(), d.getMonth(), 1); return [from.toISOString().slice(0,10), d.toISOString().slice(0,10)] as [string,string] } },
  { label: "Mes pasado",    getDates: () => { const d = new Date(); const from = new Date(d.getFullYear(), d.getMonth() - 1, 1); const to = new Date(d.getFullYear(), d.getMonth(), 0); return [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] as [string,string] } },
  { label: "Últimos 30d",   getDates: () => { const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - 29); return [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] as [string,string] } },
]

interface Props {
  customers: { id: string; name: string }[]
}

export default function WeeklyReportClient({ customers }: Props) {
  const [dateFrom,   setDateFrom]   = useState(firstDayOfMonth())
  const [dateTo,     setDateTo]     = useState(todayISO())
  const [customerId, setCustomerId] = useState<string>("all")
  const [reportData, setReportData] = useState<WeeklyReportResult | null>(null)
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [exporting,  setExporting]  = useState<Record<string, boolean>>({})

  const previewRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  async function handleGenerate() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setError("La fecha de inicio debe ser anterior o igual a la fecha de fin.")
      return
    }
    setIsLoading(true)
    setError(null)
    setReportData(null)
    try {
      const data = await getWeeklyReportData(dateFrom, dateTo, customerId)
      setReportData(data)
    } catch {
      setError("Error al generar los reportes. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  async function withExporting(key: string, action: () => Promise<void>) {
    setExporting(p => ({ ...p, [key]: true }))
    try {
      await action()
    } catch (err) {
      console.error("Export error:", err)
      alert("Error al exportar. Verifica la consola.")
    } finally {
      setExporting(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4"
        style={{ boxShadow: "var(--shadow-card)" }}>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => { const [f, t] = p.getDates(); setDateFrom(f); setDateTo(t) }}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Date from */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              <Calendar className="w-3 h-3 inline mr-1" />Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className={INPUT_DATE}
            />
          </div>

          {/* Date to */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              <Calendar className="w-3 h-3 inline mr-1" />Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayISO()}
              onChange={e => setDateTo(e.target.value)}
              className={INPUT_DATE}
            />
          </div>

          {/* Customer */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              <Users className="w-3 h-3 inline mr-1" />Cliente
            </label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className={cn(INPUT_DATE, "cursor-pointer appearance-none")}
            >
              <option value="all">Todos los clientes</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm shadow-green-200"
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generando reportes...</>
            : <><FileText className="w-4 h-4" />Generar reportes</>}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {reportData && (
        <div className="space-y-5">

          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <Fuel className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {reportData.reports.length === 0
                    ? "Sin actividad en este período"
                    : `${reportData.reports.length} cliente${reportData.reports.length > 1 ? "s" : ""} con suministros`}
                </p>
                <p className="text-xs text-slate-400">Período: {reportData.periodLabel}</p>
              </div>
            </div>

            {reportData.reports.length > 1 && (
              <button
                type="button"
                disabled={!!exporting["zip"]}
                onClick={() => withExporting("zip", () => downloadAllZip(reportData))}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {exporting["zip"] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Descargar todos (ZIP)
              </button>
            )}
          </div>

          {/* Empty */}
          {reportData.reports.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-base font-bold text-slate-700">Sin suministros registrados</p>
              <p className="text-sm text-slate-400 mt-1">No se encontraron suministros en el período seleccionado.</p>
            </div>
          )}

          {/* Per-customer cards */}
          {reportData.reports.map(report => {
            const cid = report.customer.id
            return (
              <div key={cid} className="space-y-3">
                <ReportPreviewCard
                  report={report}
                  meta={reportData}
                  previewRef={el => {
                    if (el) previewRefs.current.set(cid, el)
                    else     previewRefs.current.delete(cid)
                  }}
                />

                {/* Export buttons */}
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className="text-xs text-slate-400 font-semibold mr-1">Descargar:</span>

                  <button type="button" disabled={!!exporting[`pdf-${cid}`]}
                    onClick={() => withExporting(`pdf-${cid}`, () => downloadPDF(report, reportData))}
                    className={cn(BTN_EXPORT, "text-red-600 border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60")}>
                    {exporting[`pdf-${cid}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    PDF
                  </button>

                  <button type="button" disabled={!!exporting[`xlsx-${cid}`]}
                    onClick={() => withExporting(`xlsx-${cid}`, () => downloadExcel(report, reportData))}
                    className={cn(BTN_EXPORT, "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60")}>
                    {exporting[`xlsx-${cid}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    Excel
                  </button>

                  <button type="button" disabled={!!exporting[`png-${cid}`]}
                    onClick={() => withExporting(`png-${cid}`, async () => {
                      const el = previewRefs.current.get(cid)
                      if (el) await downloadPNG(el, report, reportData)
                    })}
                    className={cn(BTN_EXPORT, "text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100 disabled:opacity-60")}>
                    {exporting[`png-${cid}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    PNG
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
