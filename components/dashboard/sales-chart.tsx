"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { BarChart2 } from "lucide-react"
import type { SalePoint } from "@/lib/data/types"

interface SalesChartProps {
  data: SalePoint[]
}

// Placeholder skeleton grid shown when no real data exists
const EMPTY_TICKS = [
  { date: "Día 1", ventas: 0 },
  { date: "Día 2", ventas: 0 },
  { date: "Día 3", ventas: 0 },
  { date: "Día 4", ventas: 0 },
  { date: "Día 5", ventas: 0 },
  { date: "Día 6", ventas: 0 },
  { date: "Día 7", ventas: 0 },
]

export default function SalesChart({ data }: SalesChartProps) {
  const isEmpty = data.length === 0
  const chartData = isEmpty ? EMPTY_TICKS : data

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">
          Ventas de los últimos 7 días
        </h3>
        <select
          disabled={isEmpty}
          className="text-xs font-sans border border-slate-200 rounded-xl px-3 py-1.5 text-slate-400 bg-white cursor-not-allowed"
        >
          <option>Ventas (RD$)</option>
        </select>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#cbd5e1", fontFamily: "var(--font-inter)" }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => `RD$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "#cbd5e1", fontFamily: "var(--font-inter)" }}
              axisLine={false}
              tickLine={false}
              width={58}
              domain={[0, 400000]}
              ticks={[0, 100000, 200000, 300000, 400000]}
            />
            {!isEmpty && (
              <Area
                type="monotone"
                dataKey="ventas"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#salesGrad)"
                dot={{ fill: "#2563eb", r: 3.5, strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-slate-300" />
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
