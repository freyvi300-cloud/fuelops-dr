"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme:         Theme
  resolvedTheme: "light" | "dark"
  setTheme:      (t: Theme) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeCtx = createContext<ThemeContextValue>({
  theme:         "system",
  resolvedTheme: "light",
  setTheme:      () => {},
})

export function useTheme() {
  return useContext(ThemeCtx)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KEY = "fuelops-theme"

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemPreference() : theme
}

function applyTheme(theme: Theme): "light" | "dark" {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle("dark", resolved === "dark")
  return resolved
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,    setThemeState] = useState<Theme>("system")
  const [resolved, setResolved]   = useState<"light" | "dark">("light")

  // On mount: read localStorage and apply immediately
  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "system"
    setThemeState(stored)
    setResolved(applyTheme(stored))
  }, [])

  // Track system preference changes when mode = "system"
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (theme === "system") setResolved(applyTheme("system"))
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem(KEY, t)
    setResolved(applyTheme(t))
  }

  return (
    <ThemeCtx.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}
