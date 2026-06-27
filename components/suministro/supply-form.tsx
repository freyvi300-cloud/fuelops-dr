"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft, Users, Truck, Camera, Upload, X,
  CreditCard, Banknote, Fuel, CheckCircle2,
  ChevronDown, Sparkles, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedCustomer } from "@/app/actions/customers"

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentType = "credit" | "cash"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRD(amount: number) {
  return `RD$${amount.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function now() {
  return new Intl.DateTimeFormat("es-DO", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date())
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  step,
  children,
}: {
  icon: React.ElementType
  title: string
  step: number
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Section header */}
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

// ─── Customer selector ────────────────────────────────────────────────────────

function CustomerSelector({
  customers,
  selected,
  onSelect,
}: {
  customers: SerializedCustomer[]
  selected: SerializedCustomer | null
  onSelect: (c: SerializedCustomer | null) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const active = customers.filter(
    (c) =>
      c.status === "ACTIVE" &&
      c.name.toLowerCase().includes(query.toLowerCase())
  )

  function handleSelect(c: SerializedCustomer) {
    onSelect(c)
    setQuery("")
    setOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">
              {selected.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm leading-tight">{selected.name}</p>
            {selected.phone && (
              <p className="text-[11px] font-sans text-slate-500 mt-0.5">{selected.phone}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleClear}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
          title="Cambiar cliente"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar cliente por nombre..."
          className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {open && (
        <div className="absolute z-20 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {active.length === 0 ? (
            <div className="px-4 py-3 text-sm font-sans text-slate-400 text-center">
              {query ? "No se encontraron clientes" : "No hay clientes activos"}
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
              {active.map((c) => (
                <li key={c.id}>
                  <button
                    onMouseDown={() => handleSelect(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                  >
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-slate-600 text-xs font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      {c.phone && (
                        <p className="text-[11px] font-sans text-slate-400">{c.phone}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href="/clientes"
              className="text-xs font-sans font-semibold text-blue-600 hover:text-blue-700"
            >
              + Agregar nuevo cliente
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

function PhotoUpload({
  preview,
  onChange,
  onClear,
}: {
  preview: string | null
  onChange: (file: File, preview: string) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

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
          <button
            onClick={() => inputRef.current?.click()}
            className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white transition-colors shadow-sm"
          >
            Cambiar foto
          </button>
          <button
            onClick={onClear}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg text-slate-500 hover:bg-white transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* AI badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-amber-500/90 backdrop-blur-sm px-2.5 py-1 rounded-lg">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-[11px] font-semibold text-white">Lectura IA próximamente</span>
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
      >
        <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
          <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">
            Tomar foto o subir imagen
          </p>
          <p className="text-xs font-sans text-slate-400 mt-1">
            Foto del medidor al inicio y fin del suministro
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-sans text-slate-400">
          <span className="flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" /> Cámara
          </span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" /> Galería
          </span>
        </div>
      </button>

      {/* AI notice */}
      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-sans text-amber-700 leading-snug">
          <span className="font-semibold">Próximamente:</span> La IA leerá automáticamente
          los galones desde la foto del medidor.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface SupplyFormProps {
  customers: SerializedCustomer[]
}

export default function SupplyForm({ customers }: SupplyFormProps) {
  const [customer, setCustomer] = useState<SerializedCustomer | null>(null)
  const [truck, setTruck] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gallons, setGallons] = useState("")
  const [pricePerGallon, setPricePerGallon] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("cash")
  const [notes, setNotes] = useState("")

  const gallonsNum = parseFloat(gallons) || 0
  const priceNum = parseFloat(pricePerGallon) || 0
  const total = gallonsNum * priceNum

  const canConfirm = customer !== null && gallonsNum > 0 && priceNum > 0

  // Credit limit check
  const availableCredit = customer
    ? customer.creditLimit - customer.currentBalance
    : 0
  const exceedsCredit =
    paymentType === "credit" && customer !== null && total > availableCredit

  const handlePhotoChange = useCallback((file: File, preview: string) => {
    void file // will be used for upload in future
    setPhotoPreview(preview)
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Registrar suministro
              </h1>
              <p className="text-[11px] font-sans text-slate-400 mt-0.5 capitalize">{now()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
            <Fuel className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Nuevo suministro</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable form body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* ── Step 1: Cliente ─────────────────────────────────────────── */}
          <Section icon={Users} title="Cliente" step={1}>
            <CustomerSelector
              customers={customers}
              selected={customer}
              onSelect={setCustomer}
            />

            {/* Credit info when customer selected + credit payment */}
            {customer && paymentType === "credit" && (
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
                  Crédito disponible:{" "}
                  <strong>{formatRD(availableCredit)}</strong>
                  {" "}de{" "}
                  <strong>{formatRD(customer.creditLimit)}</strong>
                  {exceedsCredit && " — El total supera el límite disponible."}
                </span>
              </div>
            )}
          </Section>

          {/* ── Step 2: Camión ──────────────────────────────────────────── */}
          <Section icon={Truck} title="Camión / Equipo" step={2}>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={truck}
                onChange={(e) => setTruck(e.target.value)}
                placeholder="Placa o descripción del vehículo"
                className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
            <p className="mt-2 text-[11px] font-sans text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              El módulo de camiones conectará aquí automáticamente próximamente.
            </p>
          </Section>

          {/* ── Step 3: Foto del medidor ─────────────────────────────────── */}
          <Section icon={Camera} title="Foto del medidor" step={3}>
            <PhotoUpload
              preview={photoPreview}
              onChange={handlePhotoChange}
              onClear={() => setPhotoPreview(null)}
            />

            {/* Gallons input */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Galones dispensados <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pr-16 pl-4 py-3 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-right font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                  gal
                </span>
              </div>
            </div>
          </Section>

          {/* ── Step 4: Tipo de pago ─────────────────────────────────────── */}
          <Section icon={CreditCard} title="Tipo de pago" step={4}>
            <div className="grid grid-cols-2 gap-3">
              {(["cash", "credit"] as PaymentType[]).map((type) => {
                const active = paymentType === type
                const Icon = type === "cash" ? Banknote : CreditCard
                const label = type === "cash" ? "Contado" : "Crédito"
                const desc = type === "cash"
                  ? "Pago inmediato en efectivo o transferencia"
                  : "Se agrega a la cuenta del cliente"

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      active
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      active ? "bg-blue-600" : "bg-slate-100"
                    )}>
                      <Icon className={cn("w-4.5 h-4.5", active ? "text-white" : "text-slate-400")}
                        style={{ width: "18px", height: "18px" }} />
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "text-sm font-bold",
                        active ? "text-blue-700" : "text-slate-700"
                      )}>
                        {label}
                      </p>
                      <p className="text-[10px] font-sans text-slate-400 mt-0.5 leading-snug">
                        {desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ── Step 5: Precio y total ───────────────────────────────────── */}
          <Section icon={Fuel} title="Precio y total" step={5}>
            {/* Price per gallon */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Precio por galón (RD$) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  RD$
                </span>
                <input
                  type="number"
                  value={pricePerGallon}
                  onChange={(e) => setPricePerGallon(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-right font-semibold"
                />
              </div>
            </div>

            {/* Total display */}
            <div className={cn(
              "rounded-xl p-5 border transition-all",
              total > 0
                ? "bg-blue-600 border-blue-600"
                : "bg-slate-50 border-slate-200"
            )}>
              {/* Calculation breakdown */}
              {gallonsNum > 0 && priceNum > 0 && (
                <p className={cn(
                  "text-xs font-sans mb-3 text-center",
                  total > 0 ? "text-blue-200" : "text-slate-400"
                )}>
                  {gallonsNum.toLocaleString("es-DO", { maximumFractionDigits: 2 })} gal
                  {" × "}
                  {formatRD(priceNum)}
                </p>
              )}

              {/* Total amount */}
              <p className={cn(
                "text-center font-bold text-3xl font-display tracking-tight",
                total > 0 ? "text-white" : "text-slate-300"
              )}>
                {total > 0 ? formatRD(total) : "RD$0.00"}
              </p>
              <p className={cn(
                "text-center text-xs font-sans mt-1.5 font-medium",
                total > 0 ? "text-blue-200" : "text-slate-400"
              )}>
                Total a {paymentType === "cash" ? "cobrar" : "facturar"}
              </p>
            </div>
          </Section>

          {/* ── Step 6: Notas opcionales ─────────────────────────────────── */}
          <Section icon={Fuel} title="Observaciones" step={6}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones del suministro (opcional)..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-sans text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
            />
          </Section>

          {/* ── Confirm button ───────────────────────────────────────────── */}
          <div className="pb-6">
            {exceedsCredit && (
              <div className="flex items-center gap-2 px-4 py-3 mb-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs font-sans text-red-700">
                  El total supera el límite de crédito disponible del cliente.
                  Cambia a <strong>Contado</strong> o ajusta los galones.
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={!canConfirm || exceedsCredit}
              className={cn(
                "w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold transition-all",
                canConfirm && !exceedsCredit
                  ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg shadow-blue-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              <CheckCircle2 className="w-5 h-5" />
              Confirmar suministro
            </button>

            {!canConfirm && (
              <p className="text-center text-xs font-sans text-slate-400 mt-2.5">
                {!customer
                  ? "Selecciona un cliente para continuar"
                  : gallonsNum === 0
                  ? "Ingresa los galones dispensados"
                  : "Ingresa el precio por galón"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
