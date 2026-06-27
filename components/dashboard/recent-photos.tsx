import Link from "next/link"
import type { MeterPhoto } from "@/lib/data/types"

interface RecentPhotosProps {
  photos: MeterPhoto[]
}

export default function RecentPhotos({ photos }: RecentPhotosProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">Últimas fotos recibidas</h3>
        <Link href="/inventario" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Ver todas
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {photos.map((photo, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="bg-gray-900 rounded-xl aspect-square flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-gray-800 transition-colors">
              <p className="text-gray-500 text-[7px] font-mono uppercase tracking-widest mb-0.5">GALLONS</p>
              <p className="text-green-400 font-mono text-sm font-bold tracking-wider leading-none">
                {photo.reading}
              </p>
              <div className="flex gap-0.5 mt-1.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="w-1.5 h-2.5 bg-gray-700 rounded-sm border border-gray-600" />
                ))}
              </div>
            </div>
            <p className="text-[10px] font-sans text-slate-400 text-center font-medium">{photo.time}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 text-center">
        <Link href="/inventario" className="text-xs font-sans text-blue-600 hover:text-blue-700 font-medium transition-colors">
          Ver todas las fotos →
        </Link>
      </div>
    </div>
  )
}
