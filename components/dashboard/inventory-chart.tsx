"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { Droplets } from "lucide-react"
import type { InventoryPoint } from "@/lib/data/types"

interface InventoryChartProps {
  data: InventoryPoint[]
}

const EMPTY_TICKS = [
  { date: "Día 1", galones: 0 },
  { date: "Día 2", galones: 0 },
  { date: "Día 3", galones: 0 },
  { date: "Día 4", galones: 0 },
  { date: "Día 5", galones: 0 },
  { date: "Día 6", galones: 0 },
  { date: "Día 7", galones: 0 },
]

export default function InventoryChart({ data }: InventoryChartProps) {
  const isEmpty = data.length === 0
  const chartData = isEmpty ? EMPTY_TICKS : data

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">
          Nivel de inventario de combustible
        </h3>
        <select
          disabled={isEmpty}
          className="text-xs font-sans border border-slate-200 rounded-xl px-3 py-1.5 text-slate-400 bg-white cursor-not-allowed"
        >
          <option>Galones</option>
        </select>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#cbd5e1", fontFamily: "var(--font-inter)" }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)},000`}
              tick={{ fontSize: 11, fill: "#cbd5e1", fontFamily: "var(--font-inter)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 20000]}
              ticks={[0, 5000, 10000, 15000, 20000]}
              width={52}
            />
            {!isEmpty && (
              <Bar dataKey="galones" radius={[6, 6, 0, 0]} maxBarSize={40} fill="#bfdbfe" />
            )}
          </BarChart>
        </ResponsiveContainer>

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm font-sans text-slate-400 text-center max-w-[220px] leading-snug">
              Aún no hay datos suficientes para generar estadísticas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
