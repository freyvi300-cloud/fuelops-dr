"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import {
  Settings, Building2, Droplets, AlertTriangle,
  CheckCircle2, Bell, Shield, Save, Sparkles,
} from "lucide-react"
import { cn }                  from "@/lib/utils"
// ⚠ Do NOT import from @/lib/system-settings here — it imports Prisma,
// which is server-only and cannot be bundled for the browser.
// Type is defined inline below.
import { updateSystemSettings } from "@/app/actions/settings"
import type { SavedSettings }   from "@/app/actions/settings"

// ─── Inline type — no server-only imports ─────────────────────────────────────
// This mirrors SystemSettings from lib/system-settings.ts but lives in the
// client bundle without pulling in Prisma or any server-only module.
export interface SettingsFormData {
  businessName:       string
  rnc:                string | null
  phone:              string | null
  address:            string | null
  tankCapacity:       number
  alertRedGallons:    number
  alertYellowGallons: number
  defaultFuelPrice:   number
  ocrProvider:        "OPENAI" | "GEMINI" | "MOCK"
  ocrEnabled:         boolean
  ocrMinConfidence:   number
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT  = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
const LABEL  = "block text-xs font-medium text-slate-600 mb-1.5"

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, iconBg, iconColor, title, description, children,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  title: string; description: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50/50">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">{title}</p>
          <p className="text-[11px] font-sans text-slate-400">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Alert threshold preview ──────────────────────────────────────────────────

function AlertPreview({
  tankCapacity, alertRed, alertYellow,
}: {
  tankCapacity: number; alertRed: number; alertYellow: number
}) {
  const valid = tankCapacity > 0 && alertRed >= 0 && alertRed < alertYellow && alertYellow < tankCapacity
  if (!valid) {
    return (
      <div className="mt-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
        <p className="text-xs font-sans text-red-700">
          Los umbrales deben cumplir: 0 ≤ Rojo &lt; Amarillo &lt; Capacidad total
        </p>
      </div>
    )
  }

  const redPct    = (alertRed    / tankCapacity) * 100
  const yellowPct = (alertYellow / tankCapacity) * 100

  return (
    <div className="mt-5">
      <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Vista previa de alertas
      </p>
      <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-red-500"    style={{ width: `${redPct}%` }} />
        <div className="absolute inset-y-0 bg-amber-400"
          style={{ left: `${redPct}%`, width: `${yellowPct - redPct}%` }} />
        <div className="absolute inset-y-0 bg-emerald-500"
          style={{ left: `${yellowPct}%`, right: "0%" }} />
      </div>
      <div className="flex items-start justify-between mt-2 text-[10px] font-sans">
        <div className="text-center" style={{ width: `${redPct}%`, minWidth: 0 }}>
          <span className="text-red-600 font-bold block truncate">🔴 Crítico</span>
          <span className="text-slate-400">≤ {alertRed.toLocaleString()} gal</span>
        </div>
        <div className="text-center flex-1">
          <span className="text-amber-600 font-bold block">🟡 Bajo</span>
          <span className="text-slate-400">≤ {alertYellow.toLocaleString()} gal</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-emerald-600 font-bold block">🟢 Normal</span>
          <span className="text-slate-400">&gt; {alertYellow.toLocaleString()} gal</span>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {[
          { color: "bg-red-500",    label: `Inventario ≤ ${alertRed.toLocaleString()} gal → Alerta ROJA (crítico)` },
          { color: "bg-amber-400",  label: `Inventario ≤ ${alertYellow.toLocaleString()} gal → Alerta AMARILLA (bajo)` },
          { color: "bg-emerald-500",label: `Inventario > ${alertYellow.toLocaleString()} gal → Estado normal` },
        ].map(r => (
          <div key={r.color} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full shrink-0", r.color)} />
            <p className="text-[11px] font-sans text-slate-600">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props { settings: SettingsFormData }

export default function SettingsForm({ settings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savedData, setSavedData] = useState<SavedSettings | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  // Controlled state — these drive both the live preview AND the form values
  const [tankCapacity,       setTankCapacity]       = useState(settings.tankCapacity)
  const [alertRedGallons,    setAlertRedGallons]    = useState(settings.alertRedGallons)
  const [alertYellowGallons, setAlertYellowGallons] = useState(settings.alertYellowGallons)
  const [ocrProvider,        setOcrProvider]        = useState(settings.ocrProvider)
  const [ocrEnabled,         setOcrEnabled]         = useState(settings.ocrEnabled)
  const [ocrMinConf,         setOcrMinConf]         = useState(settings.ocrMinConfidence)
  const [defaultFuelPrice,   setDefaultFuelPrice]   = useState(settings.defaultFuelPrice)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavedData(null); setError(null)
    const fd = new FormData(e.currentTarget)

    // Safe number parser — throws if field is missing or NaN
    function numField(key: string, label: string): number {
      const raw = fd.get(key)
      if (raw === null || raw === "") throw new Error(`Campo "${label}" no encontrado en el formulario. Intenta recargar la página.`)
      const n = parseFloat(raw as string)
      if (isNaN(n)) throw new Error(`"${label}" tiene un valor inválido: "${raw}".`)
      return n
    }

    // Debug: log FormData contents (visible in browser console)
    console.log("[Settings] FormData:", Object.fromEntries(fd.entries()))

    startTransition(async () => {
      try {
        const result = await updateSystemSettings({
          businessName:       ((fd.get("businessName") as string) ?? "").trim(),
          rnc:                ((fd.get("rnc") as string) ?? "").trim()     || null,
          phone:              ((fd.get("phone") as string) ?? "").trim()   || null,
          address:            ((fd.get("address") as string) ?? "").trim() || null,
          tankCapacity:       numField("tankCapacity",       "Capacidad total"),
          alertRedGallons:    numField("alertRedGallons",    "Alerta roja"),
          alertYellowGallons: numField("alertYellowGallons", "Alerta amarilla"),
          defaultFuelPrice:   numField("defaultFuelPrice", "Precio base de combustible"),
          ocrProvider:        ((fd.get("ocrProvider") as string) || "MOCK") as "OPENAI" | "GEMINI" | "MOCK",
          ocrEnabled:         fd.get("ocrEnabled") === "true",
          ocrMinConfidence:   Math.min(100, Math.max(0, parseInt((fd.get("ocrMinConfidence") as string) ?? "90") || 90)),
        })

        // Show what was ACTUALLY saved in the DB — the user can verify
        setSavedData(result)
        router.refresh()
        setTimeout(() => setSavedData(null), 8000)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar la configuración."
        setError(msg)
        console.error("[Settings] Save error:", msg)
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración</h1>
              <p className="text-xs font-sans text-slate-400 mt-0.5">
                Los cambios aplican al Dashboard y las alertas automáticamente.
              </p>
            </div>
          </div>
          <button form="settings-form" type="submit" disabled={isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200 shrink-0">
            <Save className="w-4 h-4" />
            {isPending ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>

        {/* Success — shows ACTUAL values from DB, not what was typed */}
        {savedData && (
          <div className="mt-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-sans text-emerald-700 font-bold">
                Guardado y verificado desde la base de datos:
              </p>
            </div>
            <p className="text-[11px] font-mono text-emerald-700 pl-6">
              Tanque: {savedData.tankCapacity.toLocaleString()} gal
              {" · "}🔴 ≤ {savedData.alertRedGallons.toLocaleString()} gal
              {" · "}🟡 ≤ {savedData.alertYellowGallons.toLocaleString()} gal
              {" · "}OCR: {savedData.ocrProvider} ({savedData.ocrEnabled ? "ON" : "OFF"}) {savedData.ocrMinConfidence}%
              {" · "}Precio base: RD${savedData.defaultFuelPrice.toFixed(2)}
            </p>
          </div>
        )}
        {/* Error — always visible, full message */}
        {error && (
          <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">Error al guardar — los cambios NO fueron aplicados</p>
                <p className="text-[11px] font-sans text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form id="settings-form" onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

          {/* ── Negocio ──────────────────────────────────────────────────── */}
          <Section icon={Building2} iconBg="bg-blue-50" iconColor="text-blue-600"
            title="Información del negocio"
            description="Datos que aparecen en facturas, recibos y reportes.">
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Nombre del negocio</label>
                <input name="businessName" defaultValue={settings.businessName}
                  placeholder="Empresa de Distribución de Diésel" className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>RNC</label>
                  <input name="rnc" defaultValue={settings.rnc ?? ""}
                    placeholder="0-00-00000-0" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Teléfono</label>
                  <input name="phone" defaultValue={settings.phone ?? ""}
                    placeholder="809-000-0000" className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Dirección</label>
                <input name="address" defaultValue={settings.address ?? ""}
                  placeholder="Calle, ciudad, provincia" className={INPUT} />
              </div>
            </div>
          </Section>

          {/* ── Combustible ──────────────────────────────────────────────── */}
          <Section icon={Droplets} iconBg="bg-amber-50" iconColor="text-amber-500"
            title="Configuración de combustible e inventario"
            description="Capacidad del tanque y umbrales para las alertas automáticas.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>
                    Capacidad total del tanque (gal)
                    <span className="ml-1 text-slate-400 font-normal">— obligatorio</span>
                  </label>
                  <input name="tankCapacity" type="number" min="1" step="1" required
                    value={tankCapacity}
                    onChange={e => setTankCapacity(parseFloat(e.target.value) || 0)}
                    placeholder="20000" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>
                    Precio base actual del combustible (RD$/gal)
                    <span className="ml-1 text-slate-400 font-normal">— usado en descuentos %</span>
                  </label>
                  <input name="defaultFuelPrice" type="number" min="0" step="0.01"
                    value={defaultFuelPrice}
                    onChange={e => setDefaultFuelPrice(parseFloat(e.target.value) || 0)}
                    placeholder="250.00" className={INPUT} />
                  <p className="text-[10px] font-sans text-slate-400 mt-1">
                    Clientes con descuento porcentual calculan su precio final sobre este valor.
                    Cambiarlo no afecta facturas ya emitidas.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Umbrales de alerta — en galones absolutos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>
                      <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1.5 align-middle" />
                      Inventario mínimo — alerta ROJA (gal)
                    </label>
                    <input name="alertRedGallons" type="number" min="0" step="1" required
                      value={alertRedGallons}
                      onChange={e => setAlertRedGallons(parseFloat(e.target.value) || 0)}
                      placeholder="2000" className={INPUT} />
                    <p className="text-[10px] font-sans text-slate-400 mt-1">
                      Inventario ≤ este valor → alerta crítica roja
                    </p>
                  </div>
                  <div>
                    <label className={LABEL}>
                      <span className="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1.5 align-middle" />
                      Inventario bajo — alerta AMARILLA (gal)
                    </label>
                    <input name="alertYellowGallons" type="number" min="0" step="1" required
                      value={alertYellowGallons}
                      onChange={e => setAlertYellowGallons(parseFloat(e.target.value) || 0)}
                      placeholder="4000" className={INPUT} />
                    <p className="text-[10px] font-sans text-slate-400 mt-1">
                      Inventario ≤ este valor → alerta de precaución amarilla
                    </p>
                  </div>
                </div>
                <AlertPreview
                  tankCapacity={tankCapacity}
                  alertRed={alertRedGallons}
                  alertYellow={alertYellowGallons}
                />
              </div>
            </div>
          </Section>

          {/* ── OCR ─────────────────────────────────────────────────────── */}
          <Section icon={Sparkles} iconBg="bg-violet-50" iconColor="text-violet-600"
            title="Lectura automática del medidor (OCR)"
            description="IA que lee los galones desde la foto del medidor en Registrar suministro.">
            <div className="space-y-4">

              {/* Provider selector */}
              <div>
                <label className={LABEL}>Proveedor OCR</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "GEMINI", label: "Gemini",  model: "gemini-2.5-flash", req: "GEMINI_API_KEY",  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-400" },
                    { value: "OPENAI", label: "OpenAI",  model: "gpt-4o-mini",      req: "OPENAI_API_KEY", color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-400" },
                    { value: "MOCK",   label: "Mock",    model: "simulado",          req: "Sin API Key",    color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-400" },
                  ] as const).map(p => {
                    const active = ocrProvider === p.value
                    return (
                      <button key={p.value} type="button"
                        onClick={() => setOcrProvider(p.value)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 text-left transition-all",
                          active ? `${p.border} ${p.bg}` : "border-slate-200 hover:border-slate-300 bg-white"
                        )}>
                        <span className={cn("text-sm font-bold", active ? p.color : "text-slate-700")}>
                          {p.label}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">{p.model}</span>
                        <span className="text-[9px] font-sans text-slate-400">{p.req}</span>
                      </button>
                    )
                  })}
                </div>
                <input type="hidden" name="ocrProvider" value={ocrProvider} />
                {ocrProvider !== "MOCK" && (
                  <p className="text-[10px] font-sans text-slate-500 mt-2">
                    Asegúrate de configurar{" "}
                    <code className="bg-slate-100 px-1 rounded text-[9px] font-mono">
                      {ocrProvider === "OPENAI" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"}
                    </code>{" "}
                    en Vercel → Settings → Environment Variables.
                  </p>
                )}
              </div>

              {/* Enable/Disable */}
              <div>
                <label className={LABEL}>Estado del OCR</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "true",  label: "✅ Activado",   desc: "Analiza fotos automáticamente" },
                    { value: "false", label: "⏸ Desactivado", desc: "Solo entrada manual de galones" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOcrEnabled(opt.value === "true")}
                      className={cn(
                        "flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 text-left transition-all",
                        (opt.value === "true") === ocrEnabled
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <span className={cn("text-sm font-bold",
                        (opt.value === "true") === ocrEnabled ? "text-violet-700" : "text-slate-700")}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] font-sans text-slate-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="ocrEnabled" value={ocrEnabled ? "true" : "false"} />
              </div>

              {/* Min confidence */}
              <div>
                <label className={LABEL}>
                  Confianza mínima para auto-rellenar galones (%)
                  <span className="ml-1.5 text-slate-400 font-normal">— default 90%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    name="ocrMinConfidence"
                    type="number"
                    min="0" max="100" step="1"
                    value={ocrMinConf}
                    onChange={e => setOcrMinConf(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className={cn(INPUT, "w-24 text-center font-bold")}
                  />
                  <div className="flex-1">
                    <input
                      type="range" min="0" max="100" step="5"
                      value={ocrMinConf}
                      onChange={e => setOcrMinConf(parseInt(e.target.value))}
                      className="w-full accent-violet-600"
                    />
                    <div className="flex justify-between text-[10px] font-sans text-slate-400 mt-0.5">
                      <span>0% — siempre mostrar</span>
                      <span>100% — nunca mostrar</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] font-sans text-slate-500 mt-2">
                  Si la IA detecta galones con confianza{" "}
                  <strong>≥ {ocrMinConf}%</strong> → muestra botón &quot;Usar galones detectados&quot;.{" "}
                  Si es menor → muestra &quot;Revisa manualmente antes de usar&quot;.
                </p>
              </div>

              {/* OCR test link */}
              <a
                href="/ocr-test"
                className="inline-flex items-center gap-2 text-[11px] font-sans text-violet-600 hover:text-violet-700 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Probar el OCR con una imagen →
              </a>
            </div>
          </Section>

          {/* ── Notificaciones ───────────────────────────────────────────── */}
          <Section icon={Bell} iconBg="bg-orange-50" iconColor="text-orange-500"
            title="Notificaciones y alertas"
            description="Cuándo y cómo recibir alertas del sistema.">
            <div className="space-y-3">
              {["Alerta de inventario bajo", "Facturas vencidas (30 días)", "Resumen diario por WhatsApp"].map(label => (
                <label key={label} className="flex items-center gap-3 cursor-not-allowed opacity-60">
                  <div className="w-9 h-5 bg-slate-200 rounded-full relative shrink-0">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
                  </div>
                  <span className="text-sm font-sans text-slate-600">{label}</span>
                  <span className="text-[10px] text-slate-400 font-sans">(Próximamente)</span>
                </label>
              ))}
            </div>
          </Section>

          {/* ── Seguridad ────────────────────────────────────────────────── */}
          <Section icon={Shield} iconBg="bg-violet-50" iconColor="text-violet-600"
            title="Seguridad y acceso"
            description="Contraseña y sesión del administrador.">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Contraseña actual</label>
                <input disabled type="password" value="••••••••" readOnly className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Nueva contraseña</label>
                <input disabled type="password" placeholder="••••••••" className={INPUT} />
              </div>
            </div>
            <p className="text-[11px] font-sans text-slate-400 mt-3">
              Disponible cuando se active la autenticación completa.
            </p>
          </Section>

          <div className="pb-6" />
        </form>
      </div>
    </div>
  )
}
