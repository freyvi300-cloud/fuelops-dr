"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Droplets, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Correo o contraseña incorrectos, o cuenta inactiva.")
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0d1526] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#1a3fa0] dark:bg-[#0f2660] rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white text-center leading-tight">
            LBP Inversiones y Servicios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">S.R.L.</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1a2642] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-8">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-6">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-xl text-sm",
                  "border border-slate-200 dark:border-white/10",
                  "bg-slate-50 dark:bg-[#0d1526]",
                  "text-slate-800 dark:text-white",
                  "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                  "focus:outline-none focus:ring-2 focus:ring-[#1a3fa0] dark:focus:ring-blue-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-shadow duration-150",
                )}
                placeholder="correo@empresa.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-xl text-sm",
                  "border border-slate-200 dark:border-white/10",
                  "bg-slate-50 dark:bg-[#0d1526]",
                  "text-slate-800 dark:text-white",
                  "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                  "focus:outline-none focus:ring-2 focus:ring-[#1a3fa0] dark:focus:ring-blue-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-shadow duration-150",
                )}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-2.5 px-4 rounded-xl text-sm font-semibold",
                "bg-[#1a3fa0] hover:bg-[#1535880] dark:bg-[#1a3fa0] dark:hover:bg-[#1535880]",
                "text-white",
                "transition-all duration-200",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-[#1a3fa0] focus:ring-offset-2",
                "flex items-center justify-center gap-2",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando…
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          LBP Inversiones y Servicios S.R.L. © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
