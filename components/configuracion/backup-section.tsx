"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import {
  HardDriveDownload, CheckCircle2, AlertTriangle, Loader2, Clock,
  Download, RefreshCw, History, RotateCcw, ShieldAlert, XCircle,
  ChevronDown, ChevronUp, Cpu,
} from "lucide-react"
import { cn }                     from "@/lib/utils"
import {
  triggerManualBackup,
  listBackupFiles,
  getSignedDownloadUrl,
  restoreBackupAction,
} from "@/app/actions/backup"
import type {
  BackupActionResult,
  BackupListResult,
  RestoreActionResult,
} from "@/app/actions/backup"
import type { BackupFile } from "@/lib/backup/storage"

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("es-DO", {
      dateStyle: "short", timeStyle: "short",
    })
  } catch { return iso }
}

// ─── Shared card shell ────────────────────────────────────────────────────────

function Card({
  icon: Icon, iconBg, iconColor, title, description, children,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string
  title: string; description: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden dark:bg-[#111c30] dark:border-[#1e2d47]"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50/50 dark:border-[#1e2d47] dark:bg-[#162035]">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-[#e8f0ff] text-sm">{title}</p>
          <p className="text-[11px] font-sans text-slate-400 dark:text-[#5578a0]">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: BackupFile["type"] }) {
  if (type === "manual") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 dark:bg-[#071426] dark:text-blue-300 dark:border-[#1e3a5f]">
        <HardDriveDownload className="w-2.5 h-2.5" />Manual
      </span>
    )
  }
  if (type === "automatic") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-[#0a2018] dark:text-emerald-300 dark:border-[#14532d]">
        <Cpu className="w-2.5 h-2.5" />Auto
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-[#162035] dark:text-[#5578a0]">
      —
    </span>
  )
}

// ─── Download button (generates signed URL server-side) ───────────────────────

function DownloadButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true); setError(null)
    const res = await getSignedDownloadUrl(storagePath)
    if (!res.ok || !res.url) {
      setError(res.error ?? "Error al generar URL")
    } else {
      window.open(res.url, "_blank", "noopener,noreferrer")
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        title="Descargar ZIP (link válido 10 min)"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
          "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1e2d47] dark:hover:bg-[#2f4a7a] dark:text-[#e8f0ff]",
          "disabled:opacity-50",
        )}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {loading ? "Generando…" : "Descargar"}
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

// ─── 1. Backup creation card ──────────────────────────────────────────────────

function BackupCreateCard({ onCreated }: { onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [result,    setResult]       = useState<BackupActionResult | null>(null)
  const [lastRan,   setLastRan]      = useState<Date | null>(null)

  function handleBackup() {
    setResult(null)
    startTransition(async () => {
      const res = await triggerManualBackup()
      setResult(res)
      if (res.ok) { setLastRan(new Date()); onCreated() }
    })
  }

  return (
    <Card icon={HardDriveDownload} iconBg="bg-emerald-50 dark:bg-emerald-950/40"
      iconColor="text-emerald-600"
      title="Backups del sistema"
      description="Exporta todos los datos a un ZIP cifrado y los sube a Supabase Storage (privado).">

      <div className="space-y-5">
        {/* Schedule info */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-[#071426] dark:border-[#1e3a5f]">
          <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              Backup automático: diario a las 3:00 AM UTC
            </p>
            <p className="text-[11px] font-sans text-blue-600 dark:text-blue-400">
              Vercel Cron. Requiere{" "}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 rounded text-[10px]">BACKUP_SECRET</code>{" "}
              en variables de entorno.
            </p>
          </div>
        </div>

        {/* Files included */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#5578a0] mb-2">
            Contenido del ZIP
          </p>
          <div className="grid grid-cols-2 gap-1">
            {[
              "customers.json", "trucks.json", "inventory_movements.json",
              "supplies.json",  "invoices.json", "payments.json",
              "system_settings.json", "whatsapp_images.json",
              "whatsapp_conversations.json", "manifest.json",
            ].map(f => (
              <p key={f} className="text-[10px] font-mono text-slate-400 dark:text-[#5578a0]">• {f}</p>
            ))}
          </div>
          <p className="text-[10px] font-sans text-slate-400 dark:text-[#5578a0] mt-2">
            Fotos de medidores (base64) excluidas — ya están en Supabase Storage.
          </p>
        </div>

        {/* Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackup}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200/60",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
            {isPending ? "Generando backup…" : "Crear backup ahora"}
          </button>
          {lastRan && (
            <p className="text-[11px] font-sans text-slate-400 dark:text-[#5578a0]">
              Último: {lastRan.toLocaleTimeString("es-DO")}
            </p>
          )}
        </div>

        {/* Success */}
        {result?.ok && (
          <div className="p-4 bg-emerald-50 dark:bg-[#0a2018] border border-emerald-100 dark:border-[#14532d] rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Backup creado</p>
            </div>
            <div className="pl-6 space-y-0.5 text-[11px] font-sans text-emerald-700 dark:text-emerald-400">
              <p>Archivo: <span className="font-mono">{result.filename}</span></p>
              <p>Tamaño: {fmtBytes(result.sizeBytes)}</p>
              {result.tables && (
                <p>
                  {Object.entries(result.tables)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            {result.storagePath && (
              <div className="pl-6">
                <DownloadButton storagePath={result.storagePath} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {result && !result.ok && (
          <div className="p-4 bg-red-50 dark:bg-[#1f0a0a] border border-red-100 dark:border-[#7f1d1d] rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Error al crear backup</p>
                <p className="text-[11px] font-mono text-red-700 dark:text-red-400 mt-0.5">{result.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── 2. Backup history card ───────────────────────────────────────────────────

function BackupHistoryCard({
  refreshKey,
  onSelectRestore,
}: {
  refreshKey:      number
  onSelectRestore: (file: BackupFile) => void
}) {
  const [loading, setLoading]   = useState(false)
  const [result,  setResult]    = useState<BackupListResult | null>(null)
  const [expanded, setExpanded] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listBackupFiles()
    setResult(res)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const files = result?.files ?? []

  return (
    <Card icon={History} iconBg="bg-violet-50 dark:bg-violet-950/40" iconColor="text-violet-600"
      title="Historial de backups"
      description="Últimos 20 backups del bucket backups. Descarga genera un link privado válido 10 min.">

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#9aabce] hover:text-slate-700 font-medium"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Ocultar" : "Mostrar"} ({files.length})
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#9aabce] hover:text-slate-700 font-medium"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {expanded && (
          <>
            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-2 py-4 text-slate-400 dark:text-[#5578a0]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Cargando historial…</span>
              </div>
            )}

            {/* Error */}
            {!loading && result && !result.ok && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-[#1f0a0a] border border-red-100 dark:border-[#7f1d1d]">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-sans text-red-700 dark:text-red-300">{result.error}</p>
              </div>
            )}

            {/* Empty */}
            {!loading && result?.ok && files.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-[#5578a0] py-4 text-center">
                No hay backups en el bucket aún.
              </p>
            )}

            {/* Table */}
            {!loading && files.length > 0 && (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#1e2d47]">
                      <th className="text-left px-2 pb-2 font-semibold text-slate-500 dark:text-[#9aabce]">Archivo</th>
                      <th className="text-left px-2 pb-2 font-semibold text-slate-500 dark:text-[#9aabce]">Tipo</th>
                      <th className="text-left px-2 pb-2 font-semibold text-slate-500 dark:text-[#9aabce]">Fecha</th>
                      <th className="text-right px-2 pb-2 font-semibold text-slate-500 dark:text-[#9aabce]">Tamaño</th>
                      <th className="text-right px-2 pb-2 font-semibold text-slate-500 dark:text-[#9aabce]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#1e2d47]">
                    {files.map(f => (
                      <tr key={f.storagePath} className="hover:bg-slate-50/50 dark:hover:bg-[#162035]/50 transition-colors">
                        <td className="px-2 py-2.5">
                          <span className="font-mono text-[10px] text-slate-600 dark:text-[#9aabce] break-all">
                            {f.filename}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <TypeBadge type={f.type} />
                        </td>
                        <td className="px-2 py-2.5 whitespace-nowrap text-slate-500 dark:text-[#9aabce]">
                          {fmtDate(f.createdAt)}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-500 dark:text-[#9aabce] whitespace-nowrap">
                          {fmtBytes(f.sizeBytes)}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <DownloadButton storagePath={f.storagePath} />
                            <button
                              onClick={() => onSelectRestore(f)}
                              title="Restaurar desde este backup"
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100",
                                "dark:bg-[#1c1200] dark:hover:bg-[#2a1c00] dark:text-amber-300 dark:border-[#78350f]",
                              )}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restaurar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ─── 3. Restore card ──────────────────────────────────────────────────────────

const CONFIRM_WORD = "RESTAURAR"

function RestoreCard({
  file,
  onCancel,
  onSuccess,
}: {
  file:      BackupFile
  onCancel:  () => void
  onSuccess: () => void
}) {
  const [confirm,   setConfirm]   = useState("")
  const [isPending, startTransition] = useTransition()
  const [result,    setResult]    = useState<RestoreActionResult | null>(null)

  const ready = confirm.trim().toUpperCase() === CONFIRM_WORD

  function handleRestore() {
    if (!ready) return
    setResult(null)
    startTransition(async () => {
      const res = await restoreBackupAction(file.storagePath)
      setResult(res)
      if (res.ok) onSuccess()
    })
  }

  return (
    <Card icon={ShieldAlert} iconBg="bg-red-50 dark:bg-red-950/40" iconColor="text-red-600"
      title="Restaurar backup"
      description="Esta acción reemplaza todos los datos actuales. Un backup de seguridad se crea antes.">

      <div className="space-y-5">
        {/* Warning */}
        <div className="p-4 bg-red-50 dark:bg-[#1f0a0a] border-2 border-red-200 dark:border-red-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-bold text-red-700 dark:text-red-300">¡Advertencia destructiva!</p>
          </div>
          <ul className="text-[11px] font-sans text-red-700 dark:text-red-400 space-y-1 pl-7 list-disc">
            <li>Todos los registros actuales serán <strong>eliminados permanentemente</strong>.</li>
            <li>Los datos del backup seleccionado reemplazarán la base de datos.</li>
            <li>Un backup de seguridad automático se crea <strong>antes</strong> de restaurar.</li>
            <li>Las fotos de medidores en Supabase Storage <strong>no se restauran</strong> (solo los metadatos).</li>
          </ul>
        </div>

        {/* Selected file */}
        <div className="p-3 bg-slate-50 dark:bg-[#162035] rounded-xl border border-slate-100 dark:border-[#1e2d47]">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-[#5578a0] uppercase tracking-wider mb-1">
            Backup a restaurar
          </p>
          <p className="font-mono text-xs text-slate-700 dark:text-[#e8f0ff]">{file.filename}</p>
          <p className="text-[11px] text-slate-400 dark:text-[#5578a0] mt-0.5">
            <TypeBadge type={file.type} />{" "}
            {fmtDate(file.createdAt)} · {fmtBytes(file.sizeBytes)}
          </p>
        </div>

        {/* Confirmation word */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#e8f0ff] mb-2">
            Escribe <span className="font-mono text-red-600 dark:text-red-400">{CONFIRM_WORD}</span> para confirmar
          </label>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            disabled={isPending || !!result?.ok}
            className={cn(
              "w-full px-3 py-2.5 border-2 rounded-xl text-sm font-mono transition-all",
              "focus:outline-none",
              ready
                ? "border-red-500 bg-red-50 text-red-700 focus:border-red-600 dark:bg-[#1f0a0a] dark:text-red-300"
                : "border-slate-200 dark:border-[#1e2d47] bg-white dark:bg-[#162035] text-slate-700 dark:text-[#e8f0ff]",
            )}
          />
        </div>

        {/* Actions */}
        {!result?.ok && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleRestore}
              disabled={!ready || isPending}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                "bg-red-600 hover:bg-red-700 text-white shadow-sm",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />}
              {isPending ? "Restaurando…" : "Restaurar ahora"}
            </button>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-[#9aabce] hover:bg-slate-100 dark:hover:bg-[#1e2d47] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Progress note */}
        {isPending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#5578a0]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Creando backup de seguridad, restaurando datos… puede tardar 30-60 segundos.
          </div>
        )}

        {/* Success */}
        {result?.ok && (
          <div className="p-4 bg-emerald-50 dark:bg-[#0a2018] border border-emerald-200 dark:border-[#14532d] rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Restauración completada exitosamente
              </p>
            </div>
            {result.safetyBackup && (
              <p className="pl-6 text-[11px] font-sans text-emerald-700 dark:text-emerald-400">
                Backup de seguridad: <span className="font-mono">{result.safetyBackup}</span>
              </p>
            )}
            {result.restored && (
              <div className="pl-6 space-y-0.5">
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Registros restaurados
                </p>
                {Object.entries(result.restored).map(([k, n]) => (
                  <p key={k} className="text-[11px] font-sans text-emerald-700 dark:text-emerald-400">
                    {n} <span className="font-mono">{k}</span>
                  </p>
                ))}
              </div>
            )}
            <div className="pl-6">
              <button
                onClick={onCancel}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {result && !result.ok && (
          <div className="p-4 bg-red-50 dark:bg-[#1f0a0a] border border-red-200 dark:border-[#7f1d1d] rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Error al restaurar</p>
                <p className="text-[11px] font-mono text-red-700 dark:text-red-400 mt-0.5">{result.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function BackupSection() {
  const [historyKey,    setHistoryKey]    = useState(0)
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null)

  function refreshHistory() { setHistoryKey(k => k + 1) }

  if (restoreTarget) {
    return (
      <RestoreCard
        file={restoreTarget}
        onCancel={() => { setRestoreTarget(null); refreshHistory() }}
        onSuccess={refreshHistory}
      />
    )
  }

  return (
    <div className="space-y-5">
      <BackupCreateCard onCreated={refreshHistory} />
      <BackupHistoryCard
        refreshKey={historyKey}
        onSelectRestore={setRestoreTarget}
      />
    </div>
  )
}
