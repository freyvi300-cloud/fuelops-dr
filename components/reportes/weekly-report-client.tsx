"use client"

import { useState, useRef } from "react"
import {
  ChevronLeft, ChevronRight, Users, Download, FileSpreadsheet,
  ImageIcon, Archive, Loader2, AlertCircle, FileText, Fuel,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getWeeklyReportData,
  type WeeklyReportResult,
  type WeeklyCustomerReport,
} from "@/app/actions/weekly-report"

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getThisWeekMonday(): string {
  const today = new Date()
  const day = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - day + 1)
  return monday.toISOString().slice(0, 10)
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

function displayWeek(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z")
  const end   = new Date(weekStart + "T00:00:00Z")
  end.setUTCDate(end.getUTCDate() + 6)
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", timeZone: "UTC" })
  const fmtFull = (d: Date) =>
    d.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
  return `${fmtDay(start)} — ${fmtFull(end)}`
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
  const { jsPDF }            = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const GREEN: [number,number,number]       = [22, 163, 74]
  const GREEN_LIGHT: [number,number,number] = [240, 253, 244]
  const GREEN_DARK: [number,number,number]  = [22, 101, 52]

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageW, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("REPORTE SEMANAL DE CONSUMO", pageW / 2, 14, { align: "center" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(meta.businessName.toUpperCase(), pageW / 2, 22, { align: "center" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(`Semana #${meta.weekNumber}`, pageW - 14, 14, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(new Date().getFullYear().toString(), pageW - 14, 21, { align: "right" })

  // ── Client info ────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  const infoY = 50
  const pairs: [string, string][] = [
    ["Cliente:", report.customer.name],
    ["Período:", meta.weekLabel],
  ]
  if (report.customer.rnc) pairs.push(["RNC:", report.customer.rnc])
  if (report.customer.phone) pairs.push(["Teléfono:", report.customer.phone])

  pairs.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(label, 15, infoY + i * 7)
    doc.setFont("helvetica", "normal")
    doc.text(value, 40, infoY + i * 7)
  })

  // ── Table ──────────────────────────────────────────────────────────────
  const tableStartY = infoY + pairs.length * 7 + 8

  autoTable(doc, {
    startY: tableStartY,
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
    headStyles: {
      fillColor: GREEN, textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 8, cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
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

  const afterTable: number = (doc as any).lastAutoTable?.finalY ?? tableStartY + 40

  // ── Totals box ────────────────────────────────────────────────────────
  const totY = afterTable + 6
  doc.setFillColor(...GREEN_LIGHT)
  doc.rect(14, totY, pageW - 28, 26, "F")
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.rect(14, totY, pageW - 28, 26, "S")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...GREEN_DARK)
  doc.text(`Total galones:  ${report.totals.totalGallons.toFixed(2)} gal`, 20, totY + 9)
  doc.text(`Total facturado: ${fmtRD(report.totals.totalBilled)}`,          20, totY + 17)
  doc.setTextColor(185, 28, 28)
  doc.text(`Balance pendiente: ${fmtRD(report.totals.balanceDue)}`, pageW - 20, totY + 13, { align: "right" })

  // ── Note ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(
    "Este reporte refleja el combustible consumido en la semana.",
    pageW / 2, totY + 38, { align: "center" },
  )

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.rect(0, pageH - 14, pageW, 14, "F")
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(0, pageH - 14, pageW, pageH - 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  const genDate = new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`Generado: ${genDate}`, 14, pageH - 5)
  doc.text(meta.businessName, pageW / 2, pageH - 5, { align: "center" })
  if (meta.businessPhone) doc.text(meta.businessPhone, pageW - 14, pageH - 5, { align: "right" })

  return doc
}

async function downloadPDF(report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const doc = await buildPDFDoc(report, meta)
  doc.save(`Reporte_${report.customer.name.replace(/\s+/g, "_")}_Sem${meta.weekNumber}.pdf`)
}

// ─── Export: Excel ────────────────────────────────────────────────────────────

async function buildExcelBuffer(
  report: WeeklyCustomerReport,
  meta:   WeeklyReportResult,
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx")

  const rows: (string | number | null)[][] = [
    ["REPORTE SEMANAL DE CONSUMO"],
    [meta.businessName],
    [],
    ["Cliente:", report.customer.name],
    ["Período:", meta.weekLabel],
    ["Semana:", `#${meta.weekNumber}`],
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
    ["TOTALES", "", "", report.totals.totalGallons, "", report.totals.totalBilled, "", ""],
    ["Balance pendiente (RD$):", "", "", "", "", report.totals.balanceDue, "", ""],
    [],
    ["Este reporte refleja el combustible consumido en la semana."],
    [`Generado: ${new Date().toLocaleDateString("es-DO")}`],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 12 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Reporte Semanal")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

async function downloadExcel(report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const buffer = await buildExcelBuffer(report, meta)
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `Reporte_${report.customer.name.replace(/\s+/g, "_")}_Sem${meta.weekNumber}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Export: PNG ──────────────────────────────────────────────────────────────

async function downloadPNG(el: HTMLDivElement, report: WeeklyCustomerReport, meta: WeeklyReportResult) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" })
  const a      = document.createElement("a")
  a.href       = canvas.toDataURL("image/png")
  a.download   = `Reporte_${report.customer.name.replace(/\s+/g, "_")}_Sem${meta.weekNumber}.png`
  a.click()
}

// ─── Export: ZIP (PDF + Excel per customer) ───────────────────────────────────

async function downloadAllZip(meta: WeeklyReportResult) {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const pdfs = zip.folder("PDFs")!
  const excels = zip.folder("Excel")!

  for (const report of meta.reports) {
    const slug = report.customer.name.replace(/\s+/g, "_")
    const [pdfDoc, xlsBuf] = await Promise.all([
      buildPDFDoc(report, meta),
      buildExcelBuffer(report, meta),
    ])
    pdfs.file(`Reporte_${slug}_Sem${meta.weekNumber}.pdf`, pdfDoc.output("arraybuffer"))
    excels.file(`Reporte_${slug}_Sem${meta.weekNumber}.xlsx`, xlsBuf)
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const a    = document.createElement("a")
  a.href     = URL.createObjectURL(blob)
  a.download = `Reportes_Semana${meta.weekNumber}.zip`
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
  const fmtGal = (n: number) => `${n.toFixed(2)} gal`

  return (
    <div
      ref={previewRef}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-green-600 px-6 py-4 flex items-start justify-between">
        <div>
          <p className="text-white text-[11px] font-semibold tracking-widest uppercase opacity-80">
            {meta.businessName}
          </p>
          <h2 className="text-white text-lg font-extrabold tracking-tight mt-0.5">
            Reporte Semanal de Consumo
          </h2>
          <p className="text-green-100 text-xs mt-1">{meta.weekLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="bg-white/20 rounded-xl px-3 py-1.5">
            <p className="text-white text-[10px] font-semibold opacity-80">SEMANA</p>
            <p className="text-white text-2xl font-extrabold leading-none">#{meta.weekNumber}</p>
          </div>
        </div>
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
              <th className="px-3 py-2.5 text-left rounded-tl-lg">Fecha</th>
              <th className="px-3 py-2.5 text-left">Rótulo</th>
              <th className="px-3 py-2.5 text-left">Camión</th>
              <th className="px-3 py-2.5 text-right">Galones</th>
              <th className="px-3 py-2.5 text-right">Precio/Gal</th>
              <th className="px-3 py-2.5 text-right">Total RD$</th>
              <th className="px-3 py-2.5 text-left rounded-tr-lg">Factura</th>
            </tr>
          </thead>
          <tbody>
            {report.supplies.map((s, i) => (
              <tr
                key={s.id}
                className={cn(
                  "border-b border-slate-100 text-xs",
                  i % 2 === 0 ? "bg-white" : "bg-green-50/40",
                )}
              >
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
            <p className="text-xl font-extrabold text-green-800">{fmtGal(report.totals.totalGallons)}</p>
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
          Este reporte refleja el combustible consumido en la semana.
        </p>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
          <span>
            Generado:{" "}
            {new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          <span className="font-semibold">{meta.businessName}</span>
          {meta.businessPhone && <span>{meta.businessPhone}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const BTN_EXPORT =
  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"

interface Props {
  customers: { id: string; name: string }[]
}

export default function WeeklyReportClient({ customers }: Props) {
  const [weekStart,  setWeekStart]  = useState(getThisWeekMonday())
  const [customerId, setCustomerId] = useState<string>("all")
  const [reportData, setReportData] = useState<WeeklyReportResult | null>(null)
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [exporting,  setExporting]  = useState<Record<string, string>>({})

  const previewRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)
    setReportData(null)
    try {
      const data = await getWeeklyReportData(weekStart, customerId)
      setReportData(data)
    } catch {
      setError("Error al generar los reportes. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  async function withExporting(key: string, action: () => Promise<void>) {
    setExporting(p => ({ ...p, [key]: "loading" }))
    try {
      await action()
    } catch (err) {
      console.error("Export error:", err)
      alert("Error al exportar. Verifica la consola.")
    } finally {
      setExporting(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  const isExporting = (key: string) => key in exporting

  return (
    <div className="space-y-5">

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4"
        style={{ boxShadow: "var(--shadow-card)" }}>

        <div className="flex flex-wrap gap-4">
          {/* Week selector */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Semana
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStart(w => addWeeks(w, -1))}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 text-center">
                {displayWeek(weekStart)}
              </div>
              <button
                type="button"
                onClick={() => setWeekStart(w => addWeeks(w, 1))}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getThisWeekMonday())}
                className="px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors whitespace-nowrap"
              >
                Esta semana
              </button>
            </div>
          </div>

          {/* Customer selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Cliente
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none cursor-pointer"
              >
                <option value="all">Todos los clientes</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm shadow-green-200"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generando reportes...</>
          ) : (
            <><FileText className="w-4 h-4" />Generar reportes</>
          )}
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
                <p className="text-xs text-slate-400">{reportData.weekLabel}</p>
              </div>
            </div>

            {reportData.reports.length > 1 && (
              <button
                type="button"
                disabled={isExporting("zip")}
                onClick={() => withExporting("zip", () => downloadAllZip(reportData))}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {isExporting("zip") ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                Descargar todos (ZIP)
              </button>
            )}
          </div>

          {/* Empty state */}
          {reportData.reports.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-base font-bold text-slate-700">Sin suministros registrados</p>
              <p className="text-sm text-slate-400 mt-1">
                No se encontraron suministros en esta semana para el cliente seleccionado.
              </p>
            </div>
          )}

          {/* Per-customer report cards */}
          {reportData.reports.map(report => {
            const cid = report.customer.id
            return (
              <div key={cid} className="space-y-3">
                {/* Preview */}
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

                  <button
                    type="button"
                    disabled={isExporting(`pdf-${cid}`)}
                    onClick={() => withExporting(`pdf-${cid}`, () => downloadPDF(report, reportData))}
                    className={cn(BTN_EXPORT, "text-red-600 border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60")}
                  >
                    {isExporting(`pdf-${cid}`)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    PDF
                  </button>

                  <button
                    type="button"
                    disabled={isExporting(`xlsx-${cid}`)}
                    onClick={() => withExporting(`xlsx-${cid}`, () => downloadExcel(report, reportData))}
                    className={cn(BTN_EXPORT, "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60")}
                  >
                    {isExporting(`xlsx-${cid}`)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    Excel
                  </button>

                  <button
                    type="button"
                    disabled={isExporting(`png-${cid}`)}
                    onClick={() => withExporting(`png-${cid}`, async () => {
                      const el = previewRefs.current.get(cid)
                      if (!el) return
                      await downloadPNG(el, report, reportData)
                    })}
                    className={cn(BTN_EXPORT, "text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100 disabled:opacity-60")}
                  >
                    {isExporting(`png-${cid}`)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <ImageIcon className="w-3.5 h-3.5" />}
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
