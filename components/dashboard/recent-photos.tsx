import Link from "next/link"

const photos = [
  { reading: "01233", time: "8:45 AM" },
  { reading: "00429", time: "8:32 AM" },
  { reading: "00895", time: "8:15 AM" },
  { reading: "00855", time: "7:50 AM" },
  { reading: "01028", time: "7:25 AM" },
  { reading: "00338", time: "7:10 AM" },
  { reading: "01851", time: "6:55 AM" },
  { reading: "00938", time: "6:40 AM" },
]

export default function RecentPhotos() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Últimas fotos recibidas</h3>
        <Link href="/inventario" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todas
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {photos.map((photo, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="bg-gray-900 rounded-lg aspect-square flex flex-col items-center justify-center p-1.5 cursor-pointer hover:bg-gray-800 transition-colors">
              <p className="text-gray-500 text-[7px] font-mono uppercase tracking-widest">GALLONS</p>
              <p className="text-green-400 font-mono text-sm font-bold tracking-wider leading-tight">
                {photo.reading}
              </p>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="w-2 h-3 bg-gray-700 rounded-sm border border-gray-600" />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center font-medium">{photo.time}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <Link href="/inventario" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          Ver todas las fotos →
        </Link>
      </div>
    </div>
  )
}
