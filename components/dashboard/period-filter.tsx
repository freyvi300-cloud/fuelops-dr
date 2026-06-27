"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

const periods = ["Hoy", "Esta semana", "Este mes"]

export default function PeriodFilter() {
  const [active, setActive] = useState("Hoy")

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              active === p
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {p}
          </button>
        ))}
      </div>

      <div className="sm:ml-auto flex items-center gap-1.5 text-sm text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
        <CalendarDays className="w-4 h-4 text-slate-400" />
        <span>17 de junio, 2025</span>
      </div>
    </div>
  )
}
