import { prisma } from "@/lib/prisma"

export interface SystemSettings {
  businessName:       string
  rnc:                string | null
  phone:              string | null
  address:            string | null
  tankCapacity:       number
  alertRedGallons:    number
  alertYellowGallons: number
  defaultFuelPrice:   number
  ocrProvider:        "OPENAI" | "GEMINI" | "MOCK"
  ocrEnabled:         boolean
  ocrMinConfidence:   number
}

export const DEFAULTS: SystemSettings = {
  businessName:       "Empresa de Distribución de Diésel",
  rnc:                null,
  phone:              null,
  address:            null,
  tankCapacity:       20_000,
  alertRedGallons:    2_000,
  alertYellowGallons: 4_000,
  defaultFuelPrice:   0,
  ocrProvider:        "MOCK",
  ocrEnabled:         true,
  ocrMinConfidence:   90,
}

function toNum(v: { toNumber(): number } | null | undefined, fallback: number): number {
  if (v == null) return fallback
  try { return v.toNumber() } catch { return fallback }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const row = await prisma.systemSettings.upsert({
      where:  { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    })
    const provider = row.ocrProvider as "OPENAI" | "GEMINI" | "MOCK"
    return {
      businessName:       row.businessName       ?? DEFAULTS.businessName,
      rnc:                row.rnc,
      phone:              row.phone,
      address:            row.address,
      tankCapacity:       toNum(row.tankCapacity,       DEFAULTS.tankCapacity),
      alertRedGallons:    toNum(row.alertRedGallons,    DEFAULTS.alertRedGallons),
      alertYellowGallons: toNum(row.alertYellowGallons, DEFAULTS.alertYellowGallons),
      defaultFuelPrice:   toNum(row.defaultFuelPrice,   DEFAULTS.defaultFuelPrice),
      ocrProvider:        ["OPENAI","GEMINI","MOCK"].includes(provider) ? provider : "MOCK",
      ocrEnabled:         row.ocrEnabled         ?? DEFAULTS.ocrEnabled,
      ocrMinConfidence:   row.ocrMinConfidence    ?? DEFAULTS.ocrMinConfidence,
    }
  } catch (err) {
    console.error("[FuelOps] getSystemSettings() failed — using defaults:", err)
    return DEFAULTS
  }
}
