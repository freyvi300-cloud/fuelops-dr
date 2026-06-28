"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import {
  Settings, Building2, Droplets, AlertTriangle,
  CheckCircle2, Bell, Shield, Save,
} from "lucide-react"
import { cn }                  from "@/lib/utils"
// ⚠ Do NOT import from @/lib/system-settings here — it imports Prisma,
// which is server-only and cannot be bundled for the browser.
// Type is defined inline below.
import { updateSystemSettings } from "@/app/actions/settings"

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
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Controlled state for the live preview
  const [tankCapacity,       setTankCapacity]       = useState(settings.tankCapacity)
  const [alertRedGallons,    setAlertRedGallons]    = useState(settings.alertRedGallons)
  const [alertYellowGallons, setAlertYellowGallons] = useState(settings.alertYellowGallons)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false); setError(null)
    const fd  = new FormData(e.currentTarget)
    const num = (k: string) => Math.max(0, parseFloat(fd.get(k) as string) || 0)

    startTransition(async () => {
      try {
        await updateSystemSettings({
          businessName:       (fd.get("businessName") as string).trim(),
          rnc:                (fd.get("rnc") as string).trim()     || null,
          phone:              (fd.get("phone") as string).trim()   || null,
          address:            (fd.get("address") as string).trim() || null,
          tankCapacity:       num("tankCapacity"),
          alertRedGallons:    num("alertRedGallons"),
          alertYellowGallons: num("alertYellowGallons"),
          defaultFuelPrice:   num("defaultFuelPrice"),
        })
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 4000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar la configuración.")
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

        {saved && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-sans text-emerald-700 font-semibold">
              Configuración guardada. El Dashboard y las alertas han sido actualizados.
            </p>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs font-sans text-red-700">{error}</p>
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
                  <label className={LABEL}>Precio por galón por defecto (RD$)</label>
                  <input name="defaultFuelPrice" type="number" min="0" step="0.01"
                    defaultValue={settings.defaultFuelPrice}
                    placeholder="0.00" className={INPUT} />
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
