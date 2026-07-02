"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  MessageCircle, Image, Clock, Fuel, CreditCard,
  X, RefreshCw, ChevronRight, AlertCircle, CheckCircle2,
  Phone, Ban, BarChart3, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  PendingConversation,
  RecentWhatsAppImage,
  WhatsAppStats,
} from "@/app/actions/whatsapp"
import { cancelConversationAction } from "@/app/actions/whatsapp"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRD = (n: number) =>
  `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtGal = (n: number) =>
  `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal`

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1) return "ahora mismo"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── State labels ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  WAITING_CONFIRMATION:    { label: "Esperando confirmar OCR",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  WAITING_CUSTOMER:        { label: "Esperando cliente",         cls: "bg-blue-50 text-blue-700 border-blue-200" },
  WAITING_PAYMENT_TYPE:    { label: "Esperando tipo de pago",    cls: "bg-violet-50 text-violet-700 border-violet-200" },
  WAITING_CONFIRM_SAVE:    { label: "Esperando guardar",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  WAITING_PAYMENT_CUSTOMER:{ label: "Esperando cliente (pago)",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  WAITING_PAYMENT_CONFIRM: { label: "Esperando confirmar pago",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, iconColor, label, value, sub,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  label: string; value: string | number; sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 font-sans mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Conversation card ────────────────────────────────────────────────────────

function ConversationCard({
  conv, onCancel, cancelling,
}: {
  conv:       PendingConversation
  onCancel:   (phone: string) => void
  cancelling: boolean
}) {
  const stateInfo = STATE_LABEL[conv.state] ?? { label: conv.state, cls: "bg-slate-50 text-slate-500 border-slate-200" }
  const isSupply  = conv.flowType === "SUPPLY"
  const isPayment = conv.flowType === "PAYMENT"
  const total     = isSupply && conv.gallons && conv.pricePerGallon
    ? conv.gallons * conv.pricePerGallon
    : null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4"
      style={{ boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            isPayment ? "bg-emerald-50" : "bg-blue-50",
          )}>
            {isPayment
              ? <CreditCard className="w-5 h-5 text-emerald-600" />
              : <Fuel className="w-5 h-5 text-blue-600" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-800 text-sm">
                {isPayment ? "Comprobante de pago" : "Suministro de combustible"}
              </p>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                stateInfo.cls,
              )}>
                {stateInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-sans text-slate-500">+{conv.phoneNumber}</p>
              <span className="text-slate-300">·</span>
              <Clock className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-sans text-slate-400">{timeAgo(conv.updatedAt)}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => onCancel(conv.phoneNumber)}
          disabled={cancelling}
          title="Cancelar esta conversación"
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Details */}
      {isSupply && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {conv.gallons !== undefined && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Galones</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{fmtGal(conv.gallons)}</p>
              {conv.confidence !== undefined && (
                <p className="text-[10px] text-slate-400 font-sans">OCR {conv.confidence}%</p>
              )}
            </div>
          )}
          {conv.customerName && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate">{conv.customerName}</p>
              {conv.truckName && (
                <p className="text-[10px] text-slate-400 font-sans truncate">{conv.truckName}</p>
              )}
            </div>
          )}
          {total !== null && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total estimado</p>
              <p className="font-bold text-blue-700 text-sm mt-0.5">{fmtRD(total)}</p>
              {conv.paymentType && (
                <p className="text-[10px] text-slate-400 font-sans">
                  {conv.paymentType === "CASH" ? "Efectivo" : "Crédito"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isPayment && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {conv.paymentAmount !== undefined && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Monto</p>
              <p className="font-bold text-emerald-700 text-sm mt-0.5">{fmtRD(conv.paymentAmount)}</p>
            </div>
          )}
          {conv.paymentBank && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Banco</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate">{conv.paymentBank}</p>
            </div>
          )}
          {conv.paymentReference && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Referencia</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 font-mono truncate">{conv.paymentReference}</p>
            </div>
          )}
          {conv.customerName && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate">{conv.customerName}</p>
            </div>
          )}
        </div>
      )}

      {/* Expiry warning */}
      {new Date(conv.expiresAt) < new Date(Date.now() + 5 * 60 * 1000) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] font-sans text-amber-700">
            Expira pronto — el empleado debe responder antes de que el flujo caduque.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Image row ────────────────────────────────────────────────────────────────

function ImageRow({ img }: { img: RecentWhatsAppImage }) {
  const hasOcr    = img.ocrGallons !== null
  const [preview, setPreview] = useState(false)

  return (
    <>
      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setPreview(true)}>
        <td className="pl-5 pr-4 py-3.5">
          <p className="text-xs font-medium text-slate-700">+{img.senderPhone}</p>
          {img.senderName && (
            <p className="text-[10px] font-sans text-slate-400 mt-0.5">{img.senderName}</p>
          )}
        </td>
        <td className="px-4 py-3.5">
          <p className="text-[11px] font-sans text-slate-600 max-w-[180px] truncate">
            {img.caption ?? <span className="text-slate-300 italic">Sin descripción</span>}
          </p>
        </td>
        <td className="px-4 py-3.5 text-right">
          {hasOcr ? (
            <span className="font-semibold text-sm text-blue-700 tabular-nums">
              {fmtGal(img.ocrGallons!)}
            </span>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5 text-center">
          {img.ocrConfidence !== null && (
            <span className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border",
              img.ocrConfidence >= 90
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : img.ocrConfidence >= 70
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : "bg-red-50 text-red-600 border-red-100",
            )}>
              {img.ocrConfidence}%
            </span>
          )}
        </td>
        <td className="pr-5 px-4 py-3.5 text-right">
          <p className="text-[11px] font-sans text-slate-400">{timeAgo(img.createdAt)}</p>
        </td>
      </tr>

      {/* Image preview modal */}
      {preview && (
        <tr>
          <td colSpan={5}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setPreview(false)}>
              <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setPreview(false)}
                  className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-800">
                  <X className="w-4 h-4" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.storageUrl}
                  alt="WhatsApp image"
                  className="w-full rounded-2xl shadow-2xl"
                />
                {hasOcr && (
                  <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-white text-sm font-bold">{fmtGal(img.ocrGallons!)}</span>
                    <span className="text-white/70 text-xs">confianza {img.ocrConfidence}%</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  conversations: PendingConversation[]
  images:        RecentWhatsAppImage[]
  stats:         WhatsAppStats
}

export default function WhatsAppInboxClient({ conversations, images, stats }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancellingPhone, setCancellingPhone] = useState<string | null>(null)
  const [tab, setTab] = useState<"pending" | "images">("pending")
  const [cancelError, setCancelError] = useState<string | null>(null)

  function refresh() {
    startTransition(() => { router.refresh() })
  }

  async function handleCancel(phone: string) {
    setCancellingPhone(phone)
    setCancelError(null)
    try {
      const res = await cancelConversationAction(phone)
      if (!res.ok) setCancelError(res.error ?? "Error desconocido")
      else router.refresh()
    } finally {
      setCancellingPhone(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp</h1>
            <p className="text-xs font-sans text-slate-400 mt-0.5">
              Conversaciones activas, imágenes recibidas y flujos de automatización.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isPending && "animate-spin")} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            icon={MessageCircle}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="Conversaciones activas"
            value={stats.pendingCount}
            sub="Esperando respuesta del empleado"
          />
          <KpiCard
            icon={Image}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            label="Imágenes hoy"
            value={stats.imagesToday}
            sub="Fotos recibidas por WhatsApp"
          />
          <KpiCard
            icon={BarChart3}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Imágenes este mes"
            value={stats.imagesThisMonth}
            sub="Total del mes en curso"
          />
        </div>

        {/* Cancel error */}
        {cancelError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm font-sans text-red-700">{cancelError}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>

          <div className="flex border-b border-slate-100">
            {([
              { id: "pending" as const, label: `Conversaciones activas (${conversations.length})` },
              { id: "images"  as const, label: `Imágenes recibidas (${images.length})`           },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                  tab === t.id
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-500 border-transparent hover:text-slate-700",
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Pending conversations */}
          {tab === "pending" && (
            <div className="p-5">
              {conversations.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-200 mb-3" />
                  <p className="font-semibold text-slate-600 text-sm">Sin conversaciones activas</p>
                  <p className="text-xs font-sans text-slate-400 mt-1">
                    Todos los flujos han sido completados o cancelados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map(conv => (
                    <ConversationCard
                      key={conv.id}
                      conv={conv}
                      onCancel={handleCancel}
                      cancelling={cancellingPhone === conv.phoneNumber}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Images tab */}
          {tab === "images" && (
            images.length === 0 ? (
              <div className="py-12 text-center">
                <Image className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                <p className="font-semibold text-slate-600 text-sm">Sin imágenes registradas</p>
                <p className="text-xs font-sans text-slate-400 mt-1">
                  Las fotos enviadas por WhatsApp aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {[
                        { label: "TELÉFONO",    cls: "text-left pl-5 pr-4" },
                        { label: "DESCRIPCIÓN", cls: "text-left px-4"      },
                        { label: "GALONES",     cls: "text-right px-4"     },
                        { label: "CONFIANZA",   cls: "text-center px-4"    },
                        { label: "RECIBIDA",    cls: "text-right pr-5 px-4"},
                      ].map(h => (
                        <th key={h.label}
                          className={cn(
                            "text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-3",
                            h.cls,
                          )}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {images.map(img => <ImageRow key={img.id} img={img} />)}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* How it works box */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h3 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            ¿Cómo funciona el flujo automático?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans text-blue-800">
            <div>
              <p className="font-semibold mb-1.5">📷 Para registrar un suministro:</p>
              <ol className="space-y-1 text-blue-700 list-decimal list-inside">
                <li>Enviar foto del medidor por WhatsApp</li>
                <li>Incluir descripción: <span className="font-mono bg-blue-100 px-1 rounded">Cliente: Hotel X / Camión: H201</span></li>
                <li>Nova detecta galones automáticamente con IA</li>
                <li>Si hay descripción, auto-detecta cliente y camión</li>
                <li>Responder <strong>efectivo</strong> o <strong>crédito</strong></li>
                <li>Responder <strong>guardar</strong> para confirmar</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold mb-1.5">🧾 Para registrar un pago:</p>
              <ol className="space-y-1 text-blue-700 list-decimal list-inside">
                <li>Enviar foto del comprobante de transferencia</li>
                <li>Nova extrae monto, banco y referencia con IA</li>
                <li>Escribir el nombre del cliente</li>
                <li>Responder <strong>confirmar</strong> para registrar</li>
                <li>La deuda del cliente se actualiza automáticamente</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
