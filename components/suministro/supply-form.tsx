"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import Link from "next/link"
import {
  Search, Truck, Camera, Upload, X,
  CheckCircle2, AlertCircle, RotateCcw,
  Fuel, ArrowLeft, Wrench, Zap, Tag,
  Sparkles,
} from "lucide-react"
import { cn }                from "@/lib/utils"
import type { SerializedCustomer }      from "@/app/actions/customers"
import type { SerializedTruck }         from "@/app/actions/trucks"
import type { SerializedSupply, ConfirmedSupplyResult } from "@/app/actions/supplies"
import { confirmSupply }                from "@/app/actions/supplies"
// OCR — imported from "use server" file, safe in client components
import { analyzeMeterPhoto }            from "@/app/actions/ocr"

// ─── OCR types (defined inline — no server-only imports in client bundle) ─────

type OCRStatus = "idle" | "analyzing" | "done" | "error"

interface OCRResultLocal {
  gallons:      number | null
  confidence:   number
  provider:     string
  processingMs: number
}

// ─── Client-side image compression ───────────────────────────────────────────
// Resize to max 800px and convert to JPEG 80% before sending to OCR.
// Runs entirely in the browser — reduces bandwidth and API cost.

async function compressImage(base64: string, maxPx = 800, quality = 0.8): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
        else                 { width  = Math.round(width  * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(base64); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => resolve(base64)  // fallback: send original
    img.src = base64
  })
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
}
function todayISO() { return new Date().toLocaleString("es-DO", { weekday:"long", day:"numeric", month:"long" }) }
function avatarColor(name: string) {
  return AVATAR_PALETTE[name.split("").reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_PALETTE.length]
}
async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-100", className)}
      style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

// ─── 1. CLIENT SEARCH (Command Palette style) ─────────────────────────────────

function ClientSearch({
  customers, selected, onSelect,
}: {
  customers: SerializedCustomer[]
  selected:  SerializedCustomer | null
  onSelect:  (c: SerializedCustomer | null) => void
}) {
  const [query,  setQuery]  = useState("")
  const [open,   setOpen]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = query.length >= 1
    ? customers.filter(c =>
        c.status === "ACTIVE" && (
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.phone  ?? "").includes(query) ||
          (c.rnc    ?? "").toLowerCase().includes(query.toLowerCase())
        )
      ).slice(0, 8)
    : []

  function choose(c: SerializedCustomer) {
    onSelect(c)
    setQuery("")
    setOpen(false)
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(selected.name))}>
          {selected.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{selected.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-blue-700 font-semibold">{fmtRD(selected.fuelPricePerGallon)}/gal</span>
            {selected.currentBalance > 0 && (
              <span className="text-[11px] text-red-600 font-semibold">Debe {fmtRD(selected.currentBalance)}</span>
            )}
            {selected.pendingGallons > 0 && (
              <span className="text-[11px] text-amber-600 font-semibold">{fmtGal(selected.pendingGallons)} pend.</span>
            )}
          </div>
        </div>
        <button onClick={() => onSelect(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Nombre, teléfono o RNC…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {results.map(c => (
            <button
              key={c.id}
              onMouseDown={() => choose(c)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors"
            >
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.name))}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                {c.phone && <p className="text-[10px] font-sans text-slate-400">{c.phone}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold text-blue-600">{fmtRD(c.fuelPricePerGallon)}/gal</p>
                {c.currentBalance > 0 && <p className="text-[10px] text-red-500 font-semibold">Debe {fmtRD(c.currentBalance)}</p>}
              </div>
            </button>
          ))}
          {query.length >= 1 && results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Sin resultados para "{query}"</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 2. TRUCK CARDS ───────────────────────────────────────────────────────────

function TruckCards({
  trucks, customerId, selectedId, onChange,
}: {
  trucks:     SerializedTruck[]
  customerId: string
  selectedId: string
  onChange:   (id: string) => void
}) {
  const available = trucks.filter(t => t.customerId === customerId && t.status === "ACTIVE")

  if (available.length === 0) {
    return (
      <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-amber-700">Sin equipos registrados para este cliente.</p>
          <Link href="/camiones" className="text-[10px] text-amber-600 hover:text-amber-700 font-semibold">Registrar equipo →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {available.map(t => {
        const active   = selectedId === t.id
        const TypeIcon = TRUCK_TYPE_ICONS[t.type] ?? Truck
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(active ? "" : t.id)}
            className={cn(
              "flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all",
              active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200 bg-white"
            )}
          >
            <div className="mt-0.5 shrink-0">
              <TypeIcon className={cn("w-3.5 h-3.5", active ? "text-blue-600" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="bg-[#1a3fa0] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wider font-mono shrink-0">
                  {t.code}
                </span>
                {active && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
              </div>
              <p className={cn("text-xs font-semibold truncate", active ? "text-blue-800" : "text-slate-700")}>{t.name}</p>
              <p className="text-[9px] font-sans text-slate-400">
                {TRUCK_TYPE_LABELS[t.type] ?? t.type}{t.plate ? ` · ${t.plate}` : ""}
              </p>
            </div>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          "flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-[11px] font-sans",
          selectedId === ""
            ? "border-slate-300 bg-slate-50 text-slate-600"
            : "border-slate-100 text-slate-400 hover:border-slate-200"
        )}
      >
        <Truck className="w-3.5 h-3.5 shrink-0" />
        Sin equipo
      </button>
    </div>
  )
}

// ─── 3. COMPACT PHOTO UPLOAD ──────────────────────────────────────────────────

function CompactPhoto({
  preview, onChange, onClear,
}: {
  preview:  string | null
  onChange: (file: File, preview: string) => void
  onClear:  () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange(file, reader.result as string)
    reader.readAsDataURL(file)
  }

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: 80 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Medidor" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2">
          <button onClick={() => ref.current?.click()}
            className="bg-white/90 text-slate-700 text-[10px] font-semibold px-2 py-1 rounded-lg">
            Cambiar
          </button>
          <button onClick={onClear}
            className="bg-white/90 text-slate-500 p-1 rounded-lg">
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="absolute top-1 left-1 flex items-center gap-1 bg-emerald-600/90 px-1.5 py-0.5 rounded text-[9px] text-white font-semibold">
          <CheckCircle2 className="w-2.5 h-2.5" /> Adjunta
        </div>
        <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/20 transition-all group"
      >
        <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
        <div className="text-left">
          <p className="text-sm font-medium text-slate-600 group-hover:text-blue-700 transition-colors">Foto del medidor</p>
          <p className="text-[10px] font-sans text-slate-400">Opcional · Próximamente: lectura IA</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-sans text-slate-400 flex items-center gap-1"><Camera className="w-3 h-3" />Cámara</span>
          <span className="text-[10px] font-sans text-slate-400 flex items-center gap-1"><Upload className="w-3 h-3" />Galería</span>
        </div>
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
    </>
  )
}

// ─── 4. SUPPLY INFO CARD (inline) ─────────────────────────────────────────────

const NUM_INPUT = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 text-right font-semibold placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"

function SupplyInfo({
  gallons, setGallons,
  price, setPrice,
  total,
}: {
  gallons: string; setGallons: (v: string) => void
  price:   string; setPrice:   (v: string) => void
  total:   number
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <SectionLabel>Galones *</SectionLabel>
        <div className="relative">
          <input type="number" value={gallons} onChange={e => setGallons(e.target.value)}
            min="0.01" step="0.01" placeholder="0.00" className={NUM_INPUT} />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">gal</span>
        </div>
      </div>
      <div>
        <SectionLabel>RD$/gal *</SectionLabel>
        <div className="relative">
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            min="0.01" step="0.01" placeholder="0.00" className={NUM_INPUT} />
        </div>
      </div>
      <div>
        <SectionLabel>Total</SectionLabel>
        <div className={cn(
          "h-[42px] flex items-center justify-center rounded-xl font-bold text-sm transition-all",
          total > 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-300"
        )}>
          {total > 0 ? fmtRD(total) : "—"}
        </div>
      </div>
    </div>
  )
}

// ─── 5. PAYMENT TOGGLE ────────────────────────────────────────────────────────

function PaymentToggle({
  value, onChange,
}: {
  value: "CASH" | "CREDIT"
  onChange: (v: "CASH" | "CREDIT") => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["CASH","CREDIT"] as const).map(type => {
        const active = value === type
        const isCash = type === "CASH"
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
              active
                ? isCash
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-amber-500 bg-amber-50 text-amber-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
            )}
          >
            <span>{isCash ? "🟢" : "🟡"}</span>
            {isCash ? "Contado" : "Crédito"}
          </button>
        )
      })}
    </div>
  )
}

// ─── 6. CONFIRMATION SUMMARY + SUBMIT ─────────────────────────────────────────

function ConfirmCard({
  customer, truckCode, truckName,
  gallons, price, total, paymentType,
  error, isPending, onConfirm,
}: {
  customer: SerializedCustomer
  truckCode: string | null; truckName: string | null
  gallons: number; price: number; total: number
  paymentType: "CASH" | "CREDIT"
  error: string | null; isPending: boolean; onConfirm: () => void
}) {
  return (
    <div className="space-y-2.5">
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-sans text-red-700">{error}</p>
        </div>
      )}

      {/* Compact review */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs px-1">
        {[
          { label: "Cliente",  value: customer.name },
          { label: "Equipo",   value: truckCode ? `${truckCode} · ${truckName}` : "Sin equipo" },
          { label: "Galones",  value: fmtGal(gallons), color: "text-blue-600" },
          { label: "Precio",   value: `${fmtRD(price)}/gal` },
          { label: "Tipo",     value: paymentType === "CASH" ? "🟢 Contado" : "🟡 Crédito" },
        ].map(r => (
          <div key={r.label} className="flex items-baseline gap-1 min-w-0">
            <span className="text-slate-400 shrink-0">{r.label}:</span>
            <span className={cn("font-semibold truncate", r.color ?? "text-slate-800")}>{r.value}</span>
          </div>
        ))}
        <div className="col-span-2 flex items-baseline gap-2 border-t border-slate-100 pt-1.5 mt-0.5">
          <span className="text-slate-400">Total:</span>
          <span className="font-bold text-xl text-slate-900 font-display">{fmtRD(total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all shadow-md shadow-blue-200"
      >
        {isPending
          ? <><RotateCcw className="w-5 h-5 animate-spin" /> Registrando…</>
          : <><CheckCircle2 className="w-5 h-5" /> Registrar suministro</>
        }
      </button>
    </div>
  )
}

// ─── OCR RESULT DISPLAY ───────────────────────────────────────────────────────

function OCRDisplay({ status, result }: { status: OCRStatus; result: OCRResultLocal | null }) {
  if (status === "idle") return null

  if (status === "analyzing") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl mt-2">
        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="text-[11px] font-sans text-blue-700">Analizando imagen con IA…</span>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl mt-2">
        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        <span className="text-[11px] font-sans text-red-700">
          No fue posible analizar la imagen. Ingresa los galones manualmente.
        </span>
      </div>
    )
  }

  if (status === "done" && result) {
    if (result.gallons !== null) {
      return (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl mt-2 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-700">
              Galones detectados: {result.gallons.toFixed(2)} gal
            </span>
          </div>
          <p className="text-[10px] font-sans text-slate-500 pl-5 flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            Confianza: {result.confidence}%
            <span className="text-slate-300">·</span>
            {result.provider}
            <span className="text-slate-300">·</span>
            {result.processingMs}ms
          </p>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl mt-2">
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="text-[11px] font-sans text-amber-700">
          No fue posible detectar el medidor. Ingresa los galones manualmente.
        </span>
      </div>
    )
  }

  return null
}

// ─── 7. SUCCESS CARD ─────────────────────────────────────────────────────────

function SuccessCard({
  result, onReset,
}: {
  result: ConfirmedSupplyResult
  onReset: () => void
}) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-slate-50 px-6 py-10">
      <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center space-y-5"
        style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Suministro registrado</h2>
          <p className="text-xs font-mono text-emerald-600 font-bold mt-1">{result.invoiceNumber}</p>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
          {[
            { label: "Cliente",  value: result.customerName },
            ...(result.truckCode ? [{ label: "Equipo", value: `${result.truckCode} · ${result.truckName}` }] : []),
            { label: "Galones",  value: fmtGal(result.gallons) },
            { label: "Precio",   value: `${fmtRD(result.pricePerGallon)}/gal` },
            { label: "Pago",     value: result.paymentType === "CREDIT" ? "Crédito" : "Contado" },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="text-slate-400">{r.label}</span>
              <span className="font-semibold text-slate-800">{r.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-bold text-slate-700">Total</span>
            <span className="text-2xl font-bold text-slate-900 font-display">{fmtRD(result.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Otro suministro
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface SupplyFormProps {
  customers:      SerializedCustomer[]
  trucks:         SerializedTruck[]
  recentSupplies: SerializedSupply[]
}

export default function SupplyForm({ customers, trucks }: SupplyFormProps) {
  const [isPending, startTransition] = useTransition()

  // Form state
  const [customer,     setCustomer]     = useState<SerializedCustomer | null>(null)
  const [truckId,      setTruckId]      = useState("")
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gallons,      setGallons]      = useState("")
  const [price,        setPrice]        = useState("")
  const [payment,      setPayment]      = useState<"CASH" | "CREDIT">("CASH")
  const [error,        setError]        = useState<string | null>(null)
  const [confirmed,    setConfirmed]    = useState<ConfirmedSupplyResult | null>(null)

  // OCR state — lives alongside the form, does not block registration
  const [ocrStatus, setOcrStatus] = useState<OCRStatus>("idle")
  const [ocrResult, setOcrResult] = useState<OCRResultLocal | null>(null)

  // Computed
  const gallonsNum = parseFloat(gallons) || 0
  const priceNum   = parseFloat(price)   || 0
  const total      = gallonsNum * priceNum
  const canConfirm = customer !== null && gallonsNum > 0 && priceNum > 0

  // When customer selected → auto-fill price
  function handleCustomerSelect(c: SerializedCustomer | null) {
    setCustomer(c); setTruckId(""); setError(null)
    if (c && c.fuelPricePerGallon > 0) setPrice(c.fuelPricePerGallon.toFixed(2))
  }

  // Photo selected → compress → trigger OCR (non-blocking)
  const handlePhotoChange = useCallback(async (file: File, prev: string) => {
    setPhotoFile(file)
    setPhotoPreview(prev)
    setOcrStatus("analyzing")
    setOcrResult(null)

    try {
      const compressed = await compressImage(prev)   // client-side resize + JPEG
      const raw = await analyzeMeterPhoto(compressed) // server action → OpenAI Vision
      setOcrResult({
        gallons:      raw.gallons,
        confidence:   raw.confidence,
        provider:     raw.provider,
        processingMs: raw.processingMs,
      })
      setOcrStatus("done")
    } catch (err) {
      console.error("[OCR]", err)
      setOcrStatus("error")
    }
  }, [])

  // Find selected truck
  const selectedTruck = trucks.find(t => t.id === truckId) ?? null

  async function handleConfirm() {
    if (!customer || !canConfirm) return
    setError(null)
    startTransition(async () => {
      try {
        let meterPhotoB64: string | null = null
        if (photoFile) meterPhotoB64 = await fileToBase64(photoFile)
        const result = await confirmSupply({
          customerId:     customer.id,
          truckId:        truckId || null,
          gallons:        gallonsNum,
          pricePerGallon: priceNum,
          paymentType:    payment,
          meterPhotoB64,
          notes:          null,
        })
        setConfirmed(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar el suministro.")
      }
    })
  }

  function handlePhotoClear() {
    setPhotoFile(null); setPhotoPreview(null)
    setOcrStatus("idle"); setOcrResult(null)
  }

  function reset() {
    setCustomer(null); setTruckId(""); setPhotoFile(null); setPhotoPreview(null)
    setGallons(""); setPrice(""); setPayment("CASH"); setError(null); setConfirmed(null)
    setOcrStatus("idle"); setOcrResult(null)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (confirmed) return <SuccessCard result={confirmed} onReset={reset} />

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 py-3.5 shrink-0 flex items-center justify-between"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-2.5">
          <Link href="/" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Registrar suministro</h1>
            <p className="text-[10px] font-sans text-slate-400 capitalize">{todayISO()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
          <Fuel className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px] font-bold text-blue-700">Nuevo suministro</span>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* ══ LEFT COLUMN: Client + Equipment ═════════════════════════ */}
            <div className="space-y-3">

              {/* Client search */}
              <Card className="p-4">
                <SectionLabel>1 · Cliente</SectionLabel>
                <ClientSearch customers={customers} selected={customer} onSelect={handleCustomerSelect} />
              </Card>

              {/* Equipment cards */}
              {customer && (
                <Card className="p-4">
                  <SectionLabel>2 · Camión / Equipo</SectionLabel>
                  <TruckCards
                    trucks={trucks}
                    customerId={customer.id}
                    selectedId={truckId}
                    onChange={setTruckId}
                  />
                </Card>
              )}
            </div>

            {/* ══ RIGHT COLUMN: Photo + Info + Payment + Confirm ══════════ */}
            <div className="space-y-3">

              {/* Photo + OCR */}
              <Card className="p-4">
                <SectionLabel>3 · Foto del medidor (opcional)</SectionLabel>
                <CompactPhoto
                  preview={photoPreview}
                  onChange={handlePhotoChange}
                  onClear={handlePhotoClear}
                />
                <OCRDisplay status={ocrStatus} result={ocrResult} />
              </Card>

              {/* Supply info */}
              <Card className="p-4">
                <SectionLabel>4 · Galones y precio</SectionLabel>
                <SupplyInfo
                  gallons={gallons} setGallons={setGallons}
                  price={price}     setPrice={setPrice}
                  total={total}
                />
              </Card>

              {/* Payment */}
              <Card className="p-4">
                <SectionLabel>5 · Tipo de pago</SectionLabel>
                <PaymentToggle value={payment} onChange={setPayment} />

                {/* Credit warning */}
                {payment === "CREDIT" && customer && customer.creditLimit > 0 && (
                  <div className={cn(
                    "flex items-center gap-2 mt-2.5 px-3 py-2 rounded-xl border text-[11px] font-sans",
                    total > customer.creditLimit - customer.currentBalance
                      ? "bg-red-50 border-red-100 text-red-700"
                      : "bg-emerald-50 border-emerald-100 text-emerald-700"
                  )}>
                    {total > customer.creditLimit - customer.currentBalance
                      ? <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span>
                      Crédito disponible: <strong>{fmtRD(Math.max(0, customer.creditLimit - customer.currentBalance))}</strong>
                      {" / "}{fmtRD(customer.creditLimit)}
                    </span>
                  </div>
                )}
              </Card>

              {/* Confirmation */}
              {canConfirm && customer && (
                <Card className="p-4">
                  <SectionLabel>6 · Confirmar</SectionLabel>
                  <ConfirmCard
                    customer={customer}
                    truckCode={selectedTruck?.code ?? null}
                    truckName={selectedTruck?.name ?? null}
                    gallons={gallonsNum}
                    price={priceNum}
                    total={total}
                    paymentType={payment}
                    error={error}
                    isPending={isPending}
                    onConfirm={handleConfirm}
                  />
                </Card>
              )}

              {/* Hint when form not ready */}
              {!canConfirm && (
                <p className="text-center text-[11px] font-sans text-slate-400 py-2">
                  {!customer       ? "↑ Selecciona un cliente para comenzar"
                  : gallonsNum === 0 ? "↑ Ingresa los galones dispensados"
                  : "↑ Ingresa el precio por galón"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
