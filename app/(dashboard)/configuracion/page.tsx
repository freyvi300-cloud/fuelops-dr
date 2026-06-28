import { getSystemSettings } from "@/lib/system-settings"
import SettingsForm          from "@/components/configuracion/settings-form"

export const dynamic = "force-dynamic"

export default async function ConfiguracionPage() {
  const raw = await getSystemSettings()

  // Explicit primitive serialization — no Prisma Decimal or server object
  // crosses the Server → Client Component boundary.
  const settings = {
    businessName:       String(raw.businessName || ""),
    rnc:                raw.rnc     != null ? String(raw.rnc)     : null,
    phone:              raw.phone   != null ? String(raw.phone)   : null,
    address:            raw.address != null ? String(raw.address) : null,
    tankCapacity:       Math.max(0, Number(raw.tankCapacity)       || 20000),
    alertRedGallons:    Math.max(0, Number(raw.alertRedGallons)    || 2000),
    alertYellowGallons: Math.max(0, Number(raw.alertYellowGallons) || 4000),
    defaultFuelPrice:   Math.max(0, Number(raw.defaultFuelPrice)   || 0),
    ocrEnabled:         Boolean(raw.ocrEnabled ?? true),
    ocrMinConfidence:   Math.min(100, Math.max(0, Number(raw.ocrMinConfidence) || 90)),
  }

  return <SettingsForm settings={settings} />
}
