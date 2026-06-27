"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Users, Truck, Camera, Upload, X,
  CreditCard, Banknote, Fuel, CheckCircle2,
  ChevronDown, Sparkles, AlertCircle, RotateCcw,
  Package, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedCustomer } from "@/app/actions/customers"
import type { SerializedTruck }   from "@/app/actions/trucks"
import type { SerializedSupply, ConfirmedSupplyResult } from "@/app/actions/supplies"
import { confirmSupply } from "@/app/actions/supplies"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtGal(n: number) {
  return `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const AVATAR_PALETTE = [
  "bg-blue-500","bg-teal-500","bg-violet-500","bg-orange-500",
  "bg-pink-500","bg-indigo-500","bg-emerald-500","bg-rose-500",
]
function avatarColor(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, step, children }: {
  icon: React.ElementType; title: string; step: number; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{step}</span>
        </div>
        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <h2 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
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
    c => c.status === "ACTIVE" && c.name.toLowerCase().includes(query.toLowerCase())
  )

  if (selected) {
    return (
      <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(selected.name))}>
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{selected.name}</p>
            {selected.phone && <p className="text-[11px] font-sans text-slate-500">{selected.phone}</p>}
          </div>
        </div>
        <button onClick={() => { onSelect(null); setQuery(""); setTimeout(() => ref.current?.focus(), 50) }}
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
          placeholder="Buscar cliente activo..."
          className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length === 0
            ? <p className="text-sm font-sans text-slate-400 text-center py-3">{query ? "Sin resultados" : "No hay clientes activos"}</p>
            : (
              <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                {filtered.map(c => (
                  <li key={c.id}>
                    <button onMouseDown={() => { onSelect(c); setQuery(""); setOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.name))}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                        {c.phone && <p className="text-[11px] font-sans text-slate-400">{c.phone}</p>}
                      </div>
                      {c.fuelPricePerGallon > 0 && (
                        <span className="ml-auto text-[11px] font-sans text-blue-600 font-semibold shrink-0">
                          {fmtRD(c.fuelPricePerGallon)}/gal
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link href="/clientes" className="text-xs font-sans font-semibold text-blue-600 hover:text-blue-700">
              + Agregar nuevo cliente
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Truck selector ───────────────────────────────────────────────────────────

function TruckSelector({ trucks, customerId, selectedId, onSelect }: {
  trucks:     SerializedTruck[]
  customerId: string
  selectedId: string
  onSelect:   (id: string) => void
}) {
  if (!customerId) {
    return (
      <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans text-slate-400">
        Selecciona un cliente para ver sus equipos registrados.
      </div>
    )
  }

  const available = trucks.filter(t => t.customerId === customerId && t.status === "ACTIVE")

  if (available.length === 0) {
    return (
      <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-sm font-sans text-amber-700 font-semibold">Este cliente no tiene equipos registrados.</p>
        <Link href="/camiones" className="text-xs font-sans text-amber-600 hover:text-amber-700 font-semibold mt-1 inline-block">
          Registrar equipo →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {available.map(t => {
        const active = selectedId === t.id
        return (
          <button key={t.id} type="button" onClick={() => onSelect(active ? "" : t.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
              active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
            )}>
            <span className="inline-block bg-[#1a3fa0] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-widest font-mono shrink-0">
              {t.code}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn("font-semibold text-sm", active ? "text-blue-800" : "text-slate-800")}>{t.name}</p>
              {t.plate && <p className="text-[11px] font-sans text-slate-400 mt-0.5">Placa: {t.plate}</p>}
            </div>
            {active && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
          </button>
        )
      })}
      <button type="button" onClick={() => onSelect("")}
        className={cn(
          "w-full flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-sm font-sans",
          selectedId === ""
            ? "border-slate-300 bg-slate-50 text-slate-600"
            : "border-slate-200 text-slate-400 hover:border-slate-300"
        )}>
        <Truck className="w-4 h-4 shrink-0" />
        Sin equipo específico (continuar sin seleccionar)
      </button>
    </div>
  )
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

function PhotoUpload({ preview, onChange, onClear }: {
  preview: string | null
  onChange: (file: File, preview: string) => void
  onClear: () => void
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
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Foto del medidor" className="w-full h-48 object-cover" />
        <div className="absolute top-2 right-2 flex gap-2">
          <button onClick={() => ref.current?.click()}
            className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white transition-colors shadow-sm">
            Cambiar
          </button>
          <button onClick={onClear}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg text-slate-500 hover:bg-white transition-colors shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-600/90 backdrop-blur-sm px-2.5 py-1 rounded-lg">
          <CheckCircle2 className="w-3 h-3 text-white" />
          <span className="text-[11px] font-semibold text-white">Foto adjunta</span>
        </div>
        <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      </div>
    )
  }

  return (
    <>
      <button type="button" onClick={() => ref.current?.click()}
        className="w-full border-2 border-dashed border-slate-200 rounded-xl p-7 flex flex-col items-center gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
        <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
          <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">
            Tomar foto o subir imagen
          </p>
          <p className="text-xs font-sans text-slate-400 mt-1">Foto del medidor al inicio y fin del suministro</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-sans text-slate-400">
          <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Cámara</span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Galería</span>
        </div>
      </button>
      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-sans text-amber-700 leading-snug">
          <span className="font-semibold">Próximamente:</span> La IA leerá automáticamente los galones desde la foto.
        </p>
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
    </>
  )
}

// ─── Supply receipt ───────────────────────────────────────────────────────────

function SupplyReceipt({ supply, onReset }: { supply: ConfirmedSupplyResult; onReset: () => void }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Suministro confirmado</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">{fmtDatetime(supply.suppliedAt)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Receipt card */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
              <p className="text-xs font-sans font-semibold text-emerald-700 uppercase tracking-wider">
                Comprobante de suministro
              </p>
              <p className="text-[11px] font-sans text-emerald-600 mt-0.5">
                ID: {supply.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="px-6 py-5 space-y-3.5">
              {[
                { label: "Cliente",       value: supply.customerName },
                ...(supply.truckCode ? [{ label: "Equipo", value: `${supply.truckCode} · ${supply.truckName}` }] : []),
                { label: "Galones",       value: fmtGal(supply.gallons) },
                { label: "Precio / gal",  value: fmtRD(supply.pricePerGallon) },
                { label: "Tipo de pago",  value: supply.paymentType === "CREDIT" ? "Crédito" : "Contado" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs font-sans text-slate-500">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-800">{row.value}</span>
                </div>
              ))}
              {/* Total highlight */}
              <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Total</span>
                <span className="text-2xl font-bold text-slate-900 font-display tracking-tight">
                  {fmtRD(supply.total)}
                </span>
              </div>
            </div>
          </div>

          {/* What happened */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Acciones realizadas</p>
            <div className="space-y-2.5">
              {[
                { icon: Package, color: "text-blue-600", bg: "bg-blue-50",    text: `Inventario descontado: ${fmtGal(supply.gallons)}` },
                { icon: Users,   color: "text-violet-600", bg: "bg-violet-50", text: `Galones pendientes del cliente actualizados` },
                ...(supply.paymentType === "CREDIT" ? [
                  { icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50", text: `Balance acreditado: ${fmtRD(supply.total)}` }
                ] : []),
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", item.color)} />
                    </div>
                    <p className="text-xs font-sans text-slate-600">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onReset}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors">
              <RotateCcw className="w-4 h-4" />
              Nuevo suministro
            </button>
            <Link href="/inventario"
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 font-semibold text-sm px-5 py-3 rounded-xl transition-colors">
              <Package className="w-4 h-4" />
              Ver inventario
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Recent supplies sidebar strip ───────────────────────────────────────────

function RecentSupplies({ supplies }: { supplies: SerializedSupply[] }) {
  if (supplies.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-400" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Últimos suministros</p>
      </div>
      <div className="space-y-3">
        {supplies.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{s.customerName}</p>
              <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                {s.truckCode && <span className="font-mono mr-1">{s.truckCode} ·</span>}
                {fmtGal(s.gallons)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-slate-800">{fmtRD(s.total)}</p>
              <span className={cn(
                "text-[10px] font-semibold",
                s.paymentType === "CREDIT" ? "text-amber-600" : "text-emerald-600"
              )}>
                {s.paymentType === "CREDIT" ? "Crédito" : "Contado"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <Link href="/facturas" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-semibold">
          Ver historial completo →
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SupplyFormProps {
  customers:     SerializedCustomer[]
  trucks:        SerializedTruck[]
  recentSupplies: SerializedSupply[]
}

export default function SupplyForm({ customers, trucks, recentSupplies }: SupplyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [customer,       setCustomer]       = useState<SerializedCustomer | null>(null)
  const [truckId,        setTruckId]        = useState("")
  const [photoFile,      setPhotoFile]      = useState<File | null>(null)
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null)
  const [gallons,        setGallons]        = useState("")
  const [pricePerGallon, setPricePerGallon] = useState("")
  const [paymentType,    setPaymentType]    = useState<"CASH" | "CREDIT">("CASH")
  const [notes,          setNotes]          = useState("")
  const [error,          setError]          = useState<string | null>(null)
  const [confirmed,      setConfirmed]      = useState<ConfirmedSupplyResult | null>(null)

  const gallonsNum = parseFloat(gallons)    || 0
  const priceNum   = parseFloat(pricePerGallon) || 0
  const total      = gallonsNum * priceNum

  const availableCredit = customer
    ? customer.creditLimit - customer.currentBalance
    : 0
  const exceedsCredit =
    paymentType === "CREDIT" &&
    customer !== null &&
    customer.creditLimit > 0 &&
    total > availableCredit

  const canConfirm =
    customer !== null && gallonsNum > 0 && priceNum > 0 && !exceedsCredit

  // When customer changes → auto-fill price
  function handleCustomerSelect(c: SerializedCustomer | null) {
    setCustomer(c)
    setTruckId("")
    if (c && c.fuelPricePerGallon > 0) {
      setPricePerGallon(c.fuelPricePerGallon.toString())
    }
  }

  const handlePhotoChange = useCallback((file: File, preview: string) => {
    setPhotoFile(file)
    setPhotoPreview(preview)
  }, [])

  function reset() {
    setCustomer(null); setTruckId(""); setPhotoFile(null); setPhotoPreview(null)
    setGallons(""); setPricePerGallon(""); setPaymentType("CASH")
    setNotes(""); setError(null); setConfirmed(null)
    router.refresh()
  }

  async function handleConfirm() {
    if (!customer || !canConfirm) return
    setError(null)

    startTransition(async () => {
      try {
        // Convert photo to base64 if attached (≤5MB limit configured in next.config.ts)
        let meterPhotoB64: string | null = null
        if (photoFile) {
          meterPhotoB64 = await fileToBase64(photoFile)
        }

        const result = await confirmSupply({
          customerId:     customer.id,
          truckId:        truckId || null,
          gallons:        gallonsNum,
          pricePerGallon: priceNum,
          paymentType,
          meterPhotoB64,
          notes: notes || null,
        })

        setConfirmed(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al confirmar el suministro.")
      }
    })
  }

  // ── Show receipt after success ─────────────────────────────────────────────
  if (confirmed) {
    return <SupplyReceipt supply={confirmed} onReset={reset} />
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Registrar suministro</h1>
              <p className="text-[11px] font-sans text-slate-400 mt-0.5 capitalize">
                {new Intl.DateTimeFormat("es-DO", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                }).format(new Date())}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
            <Fuel className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Nuevo suministro</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* ── 1. Cliente ───────────────────────────────────────────── */}
          <Section icon={Users} title="Cliente" step={1}>
            <CustomerCombobox customers={customers} selected={customer} onSelect={handleCustomerSelect} />

            {/* Credit info */}
            {customer && paymentType === "CREDIT" && (
              <div className={cn(
                "mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-sans",
                exceedsCredit
                  ? "bg-red-50 border-red-100 text-red-700"
                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}>
                {exceedsCredit
                  ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                }
                <span>
                  Crédito disponible: <strong>{fmtRD(Math.max(0, availableCredit))}</strong>
                  {" de "}<strong>{fmtRD(customer.creditLimit)}</strong>
                  {exceedsCredit && " — el total supera el límite disponible."}
                </span>
              </div>
            )}
          </Section>

          {/* ── 2. Camión / Equipo ───────────────────────────────────── */}
          <Section icon={Truck} title="Camión / Equipo" step={2}>
            <TruckSelector
              trucks={trucks}
              customerId={customer?.id ?? ""}
              selectedId={truckId}
              onSelect={setTruckId}
            />
          </Section>

          {/* ── 3. Foto del medidor ──────────────────────────────────── */}
          <Section icon={Camera} title="Foto del medidor" step={3}>
            <PhotoUpload
              preview={photoPreview}
              onChange={handlePhotoChange}
              onClear={() => { setPhotoFile(null); setPhotoPreview(null) }}
            />
            {/* Gallons */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Galones dispensados <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="number" value={gallons}
                  onChange={e => setGallons(e.target.value)}
                  min="0.01" step="0.01" placeholder="0.00"
                  className="w-full pr-16 pl-4 py-3 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-right font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">gal</span>
              </div>
            </div>
          </Section>

          {/* ── 4. Tipo de pago ──────────────────────────────────────── */}
          <Section icon={CreditCard} title="Tipo de pago" step={4}>
            <div className="grid grid-cols-2 gap-3">
              {(["CASH", "CREDIT"] as const).map(type => {
                const active = paymentType === type
                const Icon   = type === "CASH" ? Banknote : CreditCard
                const label  = type === "CASH" ? "Contado" : "Crédito"
                const desc   = type === "CASH" ? "Pago inmediato" : "Se agrega a la cuenta"
                return (
                  <button key={type} type="button" onClick={() => setPaymentType(type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                    )}>
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
                      active ? "bg-blue-600" : "bg-slate-100")}>
                      <Icon className={cn(active ? "text-white" : "text-slate-400")} style={{ width: 18, height: 18 }} />
                    </div>
                    <p className={cn("text-sm font-bold", active ? "text-blue-700" : "text-slate-700")}>{label}</p>
                    <p className="text-[10px] font-sans text-slate-400 leading-snug text-center">{desc}</p>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ── 5. Precio y total ────────────────────────────────────── */}
          <Section icon={Fuel} title="Precio y total" step={5}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Precio por galón (RD$) <span className="text-red-500">*</span>
                {customer && customer.fuelPricePerGallon > 0 && (
                  <span className="ml-2 text-blue-600 font-normal normal-case">
                    · precio del cliente aplicado
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">RD$</span>
                <input type="number" value={pricePerGallon}
                  onChange={e => setPricePerGallon(e.target.value)}
                  min="0.01" step="0.01" placeholder="0.00"
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-right font-semibold"
                />
              </div>
            </div>

            {/* Total */}
            <div className={cn(
              "rounded-xl p-5 border transition-all",
              total > 0 ? "bg-blue-600 border-blue-600" : "bg-slate-50 border-slate-200"
            )}>
              {gallonsNum > 0 && priceNum > 0 && (
                <p className={cn("text-xs font-sans mb-2 text-center",
                  total > 0 ? "text-blue-200" : "text-slate-400")}>
                  {fmtGal(gallonsNum)} × {fmtRD(priceNum)}
                </p>
              )}
              <p className={cn("text-center font-bold text-3xl font-display tracking-tight",
                total > 0 ? "text-white" : "text-slate-300")}>
                {total > 0 ? fmtRD(total) : "RD$0.00"}
              </p>
              <p className={cn("text-center text-xs font-sans mt-1.5 font-medium",
                total > 0 ? "text-blue-200" : "text-slate-400")}>
                Total a {paymentType === "CASH" ? "cobrar" : "facturar"}
              </p>
            </div>
          </Section>

          {/* ── 6. Observaciones ─────────────────────────────────────── */}
          <Section icon={Fuel} title="Observaciones" step={6}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Observaciones del suministro (opcional)..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
            />
          </Section>

          {/* ── Recent supplies ───────────────────────────────────────── */}
          <RecentSupplies supplies={recentSupplies} />

          {/* ── Confirm ──────────────────────────────────────────────── */}
          <div className="pb-6">
            {error && (
              <div className="flex items-start gap-2 px-4 py-3 mb-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-sans text-red-700">{error}</p>
              </div>
            )}
            {exceedsCredit && (
              <div className="flex items-center gap-2 px-4 py-3 mb-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs font-sans text-amber-700">
                  El total supera el crédito disponible. Cambia a <strong>Contado</strong> o ajusta los galones.
                </p>
              </div>
            )}

            <button type="button" onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className={cn(
                "w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold transition-all",
                canConfirm && !isPending
                  ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg shadow-blue-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}>
              {isPending
                ? <><RotateCcw className="w-5 h-5 animate-spin" /> Confirmando...</>
                : <><CheckCircle2 className="w-5 h-5" /> Confirmar suministro</>
              }
            </button>

            {!canConfirm && !isPending && (
              <p className="text-center text-xs font-sans text-slate-400 mt-2.5">
                {!customer       ? "Selecciona un cliente para continuar"
                 : gallonsNum === 0 ? "Ingresa los galones dispensados"
                 : priceNum === 0   ? "Ingresa el precio por galón"
                 : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
