"use client"

import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme, type Theme } from "./theme-provider"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light",  icon: Sun,     label: "Claro"   },
  { value: "dark",   icon: Moon,    label: "Oscuro"  },
  { value: "system", icon: Monitor, label: "Sistema" },
]

interface ThemeToggleProps {
  /** compact = pill with 3 icon buttons (used in sidebar/header) */
  compact?: boolean
  /** full = card with labels (used in /configuracion) */
  full?: boolean
  className?: string
}

export default function ThemeToggle({ compact = false, full = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (full) {
    return (
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        {OPTIONS.map(({ value, icon: Icon, label }) => {
          const active = theme === value
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all text-xs font-semibold",
                active
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-600",
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          )
        })}
      </div>
    )
  }

  // Compact: three small icon buttons in a row
  return (
    <div className={cn("flex items-center gap-0.5 p-1 rounded-lg bg-white/10", className)}>
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-md transition-all",
              active
                ? "bg-white text-[#1a3fa0] shadow-sm"
                : "text-blue-200 hover:text-white hover:bg-white/10",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      })}
    </div>
  )
}
