"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"

const data = [
  { date: "11 Jun", galones: 15000 },
  { date: "12 Jun", galones: 16000 },
  { date: "13 Jun", galones: 15500 },
  { date: "14 Jun", galones: 15800 },
  { date: "15 Jun", galones: 15200 },
  { date: "16 Jun", galones: 14800 },
  { date: "17 Jun", galones: 14250 },
]

export default function InventoryChart() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-slate-800">Nivel de inventario de combustible</h3>
        <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option>Galones</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)},000`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 20000]}
            width={52}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString("es-DO")} gal`, "Inventario"]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px -2px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="galones" radius={[5, 5, 0, 0]} maxBarSize={40}>
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
