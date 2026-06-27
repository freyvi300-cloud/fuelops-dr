import Link from "next/link"
import { Plus, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Reusable page shell for stub pages — keeps the whole app visually consistent
// while individual modules are built out.

export interface PageShellProps {
  title: string
  description: string
  actionLabel: string
  actionHref?: string
  icon: LucideIcon
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  badge?: { text: string; className: string }
  children?: React.ReactNode
}

export default function PageShell({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  badge,
  children,
}: PageShellProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="bg-white border-b border-slate-100 px-6 py-5 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
                {badge && (
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", badge.className)}>
                    {badge.text}
                  </span>
                )}
              </div>
              <p className="text-xs font-sans text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          {/* Action button — links to a route or is a visual placeholder */}
          {actionHref ? (
            <Link
              href={actionHref}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {actionLabel}
            </Link>
          ) : (
            <button
              disabled
              title="Próximamente"
              className="flex items-center gap-2 bg-blue-600 opacity-60 cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
            >
              <Plus className="w-4 h-4" />
              {actionLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {children ?? (
          <div
            className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-20 gap-3"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
              <EmptyIcon className="w-7 h-7 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700 text-sm">{emptyTitle}</p>
            <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
              {emptyDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
