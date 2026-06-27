"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"

const data = [
  { date: "11 Jun", ventas: 120000 },
  { date: "12 Jun", ventas: 280000 },
  { date: "13 Jun", ventas: 180000 },
  { date: "14 Jun", ventas: 220000 },
  { date: "15 Jun", ventas: 200000 },
  { date: "16 Jun", ventas: 240000 },
  { date: "17 Jun", ventas: 350250 },
]

export default function SalesChart() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-slate-800">Ventas de los últimos 7 días</h3>
        <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option>Ventas (RD$)</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={(v) => `RD$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip
            formatter={(value) => [`RD$${Number(value).toLocaleString("es-DO")}`, "Ventas"]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px -2px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
            cursor={{ stroke: "#2563eb", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="ventas"
            stroke="#2563eb"
            strokeWidth={2.5}
            fill="url(#salesGrad)"
            dot={{ fill: "#2563eb", r: 3.5, strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
