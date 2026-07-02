"use client"

import { useState, useTransition } from "react"
import {
  HardDriveDownload, CheckCircle2, AlertTriangle, Loader2,
  Database, ExternalLink, Clock,
} from "lucide-react"
import { cn }                  from "@/lib/utils"
import { triggerManualBackup } from "@/app/actions/backup"
import type { BackupActionResult } from "@/app/actions/backup"

function fmt(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function BackupSection() {
  const [isPending, startTransition] = useTransition()
  const [result,    setResult]       = useState<BackupActionResult | null>(null)
  const [lastRan,   setLastRan]      = useState<Date | null>(null)

  function handleBackup() {
    setResult(null)
    startTransition(async () => {
      const res = await triggerManualBackup()
      setResult(res)
      if (res.ok) setLastRan(new Date())
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden dark:bg-[#111c30] dark:border-[#1e2d47]"
      style={{ boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50/50 dark:border-[#1e2d47] dark:bg-[#162035]">
        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center">
          <HardDriveDownload className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-[#e8f0ff] text-sm">Backups del sistema</p>
          <p className="text-[11px] font-sans text-slate-400 dark:text-[#5578a0]">
            Exporta todos los datos a un ZIP y los sube a Supabase Storage.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Info: automatic schedule */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-[#071426] dark:border-[#1e3a5f]">
          <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              Backup automático: diario a las 3:00 AM UTC
            </p>
            <p className="text-[11px] font-sans text-blue-600 dark:text-blue-400">
              Ejecutado por Vercel Cron. Requiere <code className="bg-blue-100 dark:bg-blue-950 px-1 rounded text-[10px]">BACKUP_SECRET</code> en variables de entorno.
            </p>
          </div>
        </div>

        {/* What's included */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#5578a0] mb-2">
            Contenido del ZIP
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              "customers.json",
              "trucks.json",
              "inventory_movements.json",
              "supplies.json",
              "invoices.json",
              "payments.json",
              "system_settings.json",
              "whatsapp_images.json",
              "whatsapp_conversations.json",
              "manifest.json",
            ].map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-slate-300 dark:text-[#5578a0] shrink-0" />
                <span className="text-[10px] font-mono text-slate-500 dark:text-[#9aabce] truncate">{f}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-sans text-slate-400 dark:text-[#5578a0] mt-2">
            Nota: fotos de medidores (base64) excluidas del ZIP — ya están en Supabase Storage.
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={handleBackup}
          disabled={isPending}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
            "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <HardDriveDownload className="w-4 h-4" />}
          {isPending ? "Generando backup..." : "Crear backup ahora"}
        </button>

        {/* Last run */}
        {lastRan && (
          <p className="text-[11px] font-sans text-slate-400 dark:text-[#5578a0]">
            Último backup manual: {lastRan.toLocaleString("es-DO")}
          </p>
        )}

        {/* Success */}
        {result?.ok && (
          <div className="p-4 bg-emerald-50 dark:bg-[#0a2018] border border-emerald-100 dark:border-[#14532d] rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Backup creado exitosamente
              </p>
            </div>
            <div className="space-y-1 text-[11px] font-sans text-emerald-700 dark:text-emerald-400 pl-6">
              <p>Archivo: <span className="font-mono">{result.filename}</span></p>
              <p>Tamaño: {fmt(result.sizeBytes ?? 0)}</p>
              {result.tables && (
                <p>
                  Registros: {Object.entries(result.tables)
                    .map(([k, n]) => `${n} ${k}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 pl-6"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Descargar ZIP
              </a>
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
                <p className="text-[11px] font-sans text-red-700 dark:text-red-400 mt-0.5 font-mono">
                  {result.error}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
