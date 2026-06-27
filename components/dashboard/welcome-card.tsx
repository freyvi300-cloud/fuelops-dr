import { Plus, Droplets } from "lucide-react"

export default function WelcomeCard() {
  return (
    <div
      className="bg-white rounded-2xl border border-blue-100 p-10 flex flex-col items-center text-center"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Icon */}
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
        <Droplets className="w-8 h-8 text-blue-600" />
      </div>

      {/* Text */}
      <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
        Bienvenido a FuelOps-DR
      </h2>
      <p className="text-sm font-sans text-slate-500 max-w-md leading-relaxed mb-7">
        Comienza registrando tu primer suministro de combustible
        para empezar a generar estadísticas.
      </p>

      {/* CTA */}
      <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm px-7 py-3 rounded-xl transition-colors shadow-sm shadow-blue-200">
        <Plus className="w-5 h-5" />
        Registrar primer suministro
      </button>

      {/* Hint */}
      <p className="text-[11px] font-sans text-slate-400 mt-4">
        También puedes comenzar agregando clientes o camiones desde el menú lateral.
      </p>
    </div>
  )
}
