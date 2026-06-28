import { getSystemSettings } from "@/lib/system-settings"
import SettingsForm          from "@/components/configuracion/settings-form"

export const dynamic = "force-dynamic"

const VALID_PROVIDERS = ["OPENAI", "GEMINI", "MOCK"] as const

export default async function ConfiguracionPage() {
  const raw = await getSystemSettings()

  // Explicit primitive serialization — no Prisma object crosses the server→client boundary
  const settings = {
    businessName:       String(raw.businessName || ""),
    rnc:                raw.rnc     != null ? String(raw.rnc)     : null,
    phone:              raw.phone   != null ? String(raw.phone)   : null,
    address:            raw.address != null ? String(raw.address) : null,
    tankCapacity:       Math.max(0, Number(raw.tankCapacity)       || 20000),
    alertRedGallons:    Math.max(0, Number(raw.alertRedGallons)    || 2000),
    alertYellowGallons: Math.max(0, Number(raw.alertYellowGallons) || 4000),
    defaultFuelPrice:   Math.max(0, Number(raw.defaultFuelPrice)   || 0),
    ocrProvider:        (VALID_PROVIDERS.includes(raw.ocrProvider as typeof VALID_PROVIDERS[number])
      ? raw.ocrProvider : "MOCK") as "OPENAI" | "GEMINI" | "MOCK",
    ocrEnabled:         Boolean(raw.ocrEnabled ?? true),
    ocrMinConfidence:   Math.min(100, Math.max(0, Number(raw.ocrMinConfidence) || 90)),
  }

  return <SettingsForm settings={settings} />
}
