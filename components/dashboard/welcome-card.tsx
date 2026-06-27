import Link from "next/link"
import { Fuel, Users, Truck } from "lucide-react"

export default function WelcomeCard() {
  return (
    <div
      className="bg-white rounded-2xl border border-blue-100 p-10 flex flex-col items-center text-center"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Icon */}
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
        <Fuel className="w-8 h-8 text-blue-600" />
      </div>

      {/* Text */}
      <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
        Bienvenido a FuelOps-DR
      </h2>
      <p className="text-sm font-sans text-slate-500 max-w-md leading-relaxed mb-7">
        Registra tu primer suministro de combustible para comenzar
        a generar estadísticas y gestionar tu negocio.
      </p>

      {/* Primary CTA */}
      <Link
        href="/suministro"
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm px-7 py-3 rounded-xl transition-colors shadow-sm shadow-blue-200"
      >
        <Fuel className="w-5 h-5" />
        Nuevo suministro
      </Link>

      {/* Secondary actions */}
      <div className="flex items-center gap-6 mt-5">
        <Link
          href="/clientes"
          className="flex items-center gap-1.5 text-xs font-sans font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          Agregar cliente
        </Link>
        <span className="text-slate-200">·</span>
        <Link
          href="/camiones"
          className="flex items-center gap-1.5 text-xs font-sans font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Truck className="w-3.5 h-3.5" />
          Registrar camión
        </Link>
      </div>
    </div>
  )
}
