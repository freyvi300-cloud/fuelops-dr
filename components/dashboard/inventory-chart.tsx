"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import type { InventoryPoint } from "@/lib/data/types"

interface InventoryChartProps {
  data: InventoryPoint[]
}

export default function InventoryChart({ data }: InventoryChartProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">
          Nivel de inventario de combustible
        </h3>
        <select className="text-xs font-sans border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
          <option>Galones</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "var(--font-inter)" }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)},000`}
            tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "var(--font-inter)" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 20000]}
            width={52}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString("es-DO")} gal`, "Inventario"]}
            contentStyle={{
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              fontSize: "12px",
              fontFamily: "var(--font-inter)",
            }}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="galones" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? "#2563eb" : "#bfdbfe"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
