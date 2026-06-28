"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

/**
 * Error boundary for /configuracion.
 * When this renders, Vercel Function Logs will show the real stack trace.
 * The digest shown here matches the error in Vercel logs.
 */
export default function ConfiguracionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to Vercel Function Logs so we can see it in production
    console.error("[/configuracion] Server Component error:", error)
  }, [error])

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-slate-50 px-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Error al cargar Configuración</h2>
        <p className="text-sm font-sans text-slate-500 mb-4 leading-relaxed">
          {error.message || "No se pudo cargar la página de configuración."}
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-5">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
