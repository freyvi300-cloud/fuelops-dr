"use client"

import { useState, useRef }  from "react"
import Link                  from "next/link"
import {
  FlaskConical, Camera, Upload, CheckCircle2,
  AlertCircle, RotateCcw, Sparkles, ArrowLeft,
  Clock, Eye, Zap,
} from "lucide-react"
import { cn }                from "@/lib/utils"
import { analyzeMeterPhoto } from "@/app/actions/ocr"

// ─── Inline type (no server-only imports) ─────────────────────────────────────
interface OCRResultLocal {
  gallons:      number | null
  confidence:   number
  rawText:      string
  provider:     string
  processingMs: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function compressImage(base64: string, maxPx = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
        else                 { width = Math.round(width * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(base64); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/jpeg", 0.8))
    }
    img.onerror = () => resolve(base64)
    img.src = base64
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  apiKeySet:        boolean
  ocrEnabled:       boolean
  ocrMinConfidence: number
}

export default function OcrTestClient({ apiKeySet, ocrEnabled, ocrMinConfidence }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [status,   setStatus]   = useState<"idle"|"analyzing"|"done"|"error">("idle")
  const [result,   setResult]   = useState<OCRResultLocal | null>(null)
  const [errMsg,   setErrMsg]   = useState<string>("")

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setPreview(reader.result as string); setStatus("idle"); setResult(null) }
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!preview) return
    setStatus("analyzing"); setResult(null); setErrMsg("")
    try {
      const compressed = await compressImage(preview)
      const r = await analyzeMeterPhoto(compressed)
      setResult(r); setStatus("done")
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err))
      setStatus("error")
    }
  }

  function handleReset() {
    setPreview(null); setStatus("idle"); setResult(null); setErrMsg("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const highConf = result && result.gallons !== null && result.confidence >= ocrMinConfidence

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-3">
          <Link href="/suministro" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Prueba de OCR</h1>
            <p className="text-[11px] font-sans text-slate-400">Herramienta interna — verifica que el lector de medidores funcione</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Status bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatusPill
              icon={Zap}
              label="OPENAI_API_KEY"
              ok={apiKeySet}
              okText="Configurado"
              failText="No configurado"
            />
            <StatusPill
              icon={Eye}
              label="OCR en suministros"
              ok={ocrEnabled}
              okText="Activado"
              failText="Desactivado"
            />
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-100"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Confianza mínima</p>
                <p className="text-sm font-bold text-slate-800">{ocrMinConfidence}%</p>
              </div>
            </div>
          </div>

          {!apiKeySet && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs font-sans">
                <p className="font-bold text-amber-800">OPENAI_API_KEY no está configurado.</p>
                <p className="text-amber-700 mt-0.5">
                  Para activar el OCR en producción:{" "}
                  <strong>Vercel → Settings → Environment Variables → OPENAI_API_KEY</strong>
                </p>
              </div>
            </div>
          )}

          {/* Upload + preview */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Imagen del medidor</p>

            {!preview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-violet-300 hover:bg-violet-50/20 transition-all group"
              >
                <div className="w-12 h-12 bg-slate-100 group-hover:bg-violet-100 rounded-xl flex items-center justify-center transition-colors">
                  <Camera className="w-6 h-6 text-slate-400 group-hover:text-violet-500 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-violet-700 transition-colors">
                    Sube una foto del medidor
                  </p>
                  <p className="text-[11px] font-sans text-slate-400 mt-1">JPG, PNG, WebP — se comprimirá antes de enviar</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-sans text-slate-400">
                  <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Cámara</span>
                  <span className="text-slate-200">·</span>
                  <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Archivo</span>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Medidor" className="w-full max-h-64 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                <div className="flex gap-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={status === "analyzing"}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    {status === "analyzing"
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analizando...</>
                      : <><Sparkles className="w-4 h-4" /> Analizar imagen</>
                    }
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold text-sm rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-100 rounded-2xl"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Error al analizar la imagen</p>
                <p className="text-[11px] font-sans text-red-600 mt-0.5">{errMsg}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {status === "done" && result && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
              style={{ boxShadow: "var(--shadow-card)" }}>
              {/* Result header */}
              <div className={cn("px-5 py-3.5 flex items-center justify-between",
                result.gallons !== null ? "bg-emerald-50 border-b border-emerald-100" : "bg-amber-50 border-b border-amber-100")}>
                <div className="flex items-center gap-2">
                  {result.gallons !== null
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <AlertCircle  className="w-5 h-5 text-amber-500" />
                  }
                  <span className={cn("font-bold text-sm",
                    result.gallons !== null ? "text-emerald-700" : "text-amber-700")}>
                    {result.gallons !== null ? "Medidor detectado" : "No fue posible detectar el medidor"}
                  </span>
                </div>
                {result.gallons !== null && (
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                    highConf ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {highConf ? `✅ Alta confianza (≥${ocrMinConfidence}%)` : `⚠ Baja confianza (<${ocrMinConfidence}%)`}
                  </span>
                )}
              </div>

              {/* Metrics grid */}
              <div className="divide-y divide-slate-50">
                {[
                  {
                    icon: Zap, label: "Galones detectados",
                    value: result.gallons !== null ? `${result.gallons.toFixed(2)} gal` : "—",
                    valueColor: result.gallons !== null ? "text-blue-700 font-bold text-lg" : "text-slate-400",
                  },
                  {
                    icon: Sparkles, label: "Nivel de confianza",
                    value: `${result.confidence}%`,
                    valueColor: result.confidence >= ocrMinConfidence ? "text-emerald-600 font-bold" : "text-amber-600 font-bold",
                  },
                  {
                    icon: FlaskConical, label: "Proveedor OCR",
                    value: result.provider,
                    valueColor: "text-slate-700 font-mono text-sm",
                  },
                  {
                    icon: Clock, label: "Tiempo de procesamiento",
                    value: `${result.processingMs.toLocaleString()} ms`,
                    valueColor: "text-slate-700",
                  },
                ].map(row => {
                  const Icon = row.icon
                  return (
                    <div key={row.label} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-sans text-slate-600">{row.label}</span>
                      </div>
                      <span className={cn("text-sm", row.valueColor)}>{row.value}</span>
                    </div>
                  )
                })}

                {/* Raw text */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-sans text-slate-600">Texto raw del proveedor</span>
                  </div>
                  <pre className="bg-slate-900 text-green-400 text-[11px] font-mono p-3 rounded-xl overflow-x-auto leading-relaxed">
                    {result.rawText || "(vacío)"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[11px] font-sans text-blue-700 leading-relaxed">
              <span className="font-bold">Esta página es solo para pruebas.</span>{" "}
              El OCR se activa automáticamente en{" "}
              <Link href="/suministro" className="underline">Registrar suministro</Link>{" "}
              al subir una foto. Ajusta los umbrales en{" "}
              <Link href="/configuracion" className="underline">Configuración</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatusPill({
  icon: Icon, label, ok, okText, failText,
}: {
  icon: React.ElementType; label: string; ok: boolean; okText: string; failText: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-100"
      style={{ boxShadow: "var(--shadow-card)" }}>
      <Icon className={cn("w-4 h-4 shrink-0", ok ? "text-emerald-500" : "text-red-400")} />
      <div>
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-bold", ok ? "text-emerald-700" : "text-red-600")}>
          {ok ? okText : failText}
        </p>
      </div>
    </div>
  )
}
