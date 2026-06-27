"use client"

import { Bell, Search, ChevronDown, Menu } from "lucide-react"

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6 gap-4 shrink-0"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <button className="md:hidden text-slate-500 hover:text-slate-700 p-1">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight">
          ¡Buenos días, Administrador!
        </h1>
        <p className="text-xs text-slate-400 font-sans font-normal leading-tight">
          Aquí tienes el resumen general de tu negocio.
        </p>
      </div>

      {/* Search */}
      <div className="relative hidden lg:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar clientes, facturas, camiones..."
          className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-sans text-slate-600 placeholder:text-slate-400 w-72 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Notifications */}
      <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors">
        <Bell className="w-5 h-5 text-slate-500" />
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
          3
        </span>
      </button>

      {/* User */}
      <button className="flex items-center gap-2.5 hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors">
        <div className="w-8 h-8 bg-[#1a3fa0] rounded-full flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-semibold font-display">A</span>
        </div>
        <div className="text-left hidden lg:block">
          <p className="text-sm font-semibold text-slate-800 leading-tight">Administrador</p>
          <p className="text-[11px] text-slate-400 font-sans leading-tight">Administrador</p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
      </button>
    </header>
  )
}
