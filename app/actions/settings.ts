"use server"

import { prisma }         from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { OcrProvider }    from "@prisma/client"

export interface UpdateSettingsData {
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

/** What was actually persisted — returned to the client for verification */
export interface SavedSettings {
  tankCapacity:       number
  alertRedGallons:    number
  alertYellowGallons: number
  ocrProvider:        string
  ocrEnabled:         boolean
  ocrMinConfidence:   number
}

export async function updateSystemSettings(
  data: UpdateSettingsData,
): Promise<SavedSettings> {
  // ── Log incoming values (visible in Vercel Function Logs) ─────────────────
  console.log("[FuelOps/settings] updateSystemSettings called with:", {
    tankCapacity:       data.tankCapacity,
    alertRedGallons:    data.alertRedGallons,
    alertYellowGallons: data.alertYellowGallons,
    ocrProvider:        data.ocrProvider,
    ocrEnabled:         data.ocrEnabled,
    ocrMinConfidence:   data.ocrMinConfidence,
  })

  // ── Validate ──────────────────────────────────────────────────────────────
  if (typeof data.tankCapacity !== "number" || isNaN(data.tankCapacity) || data.tankCapacity <= 0)
    throw new Error(`Capacidad del tanque inválida: "${data.tankCapacity}". Debe ser un número positivo.`)
  if (typeof data.alertRedGallons !== "number" || isNaN(data.alertRedGallons) || data.alertRedGallons < 0)
    throw new Error(`Alerta roja inválida: "${data.alertRedGallons}". Debe ser ≥ 0.`)
  if (typeof data.alertYellowGallons !== "number" || isNaN(data.alertYellowGallons) || data.alertYellowGallons < 0)
    throw new Error(`Alerta amarilla inválida: "${data.alertYellowGallons}". Debe ser ≥ 0.`)
  if (data.alertRedGallons >= data.alertYellowGallons)
    throw new Error(`Inventario mínimo (${data.alertRedGallons} gal) debe ser MENOR que inventario bajo (${data.alertYellowGallons} gal).`)
  if (data.alertYellowGallons >= data.tankCapacity)
    throw new Error(`Inventario bajo (${data.alertYellowGallons} gal) debe ser MENOR que capacidad total (${data.tankCapacity} gal).`)
  if (data.ocrMinConfidence < 0 || data.ocrMinConfidence > 100)
    throw new Error(`Confianza mínima debe ser 0-100, recibido: ${data.ocrMinConfidence}.`)
  if (!["OPENAI","GEMINI","MOCK"].includes(data.ocrProvider))
    throw new Error(`Proveedor OCR inválido: "${data.ocrProvider}".`)

  // ── Explicit field mapping (no spread) — prevents unexpected fields ───────
  const payload = {
    businessName:       data.businessName,
    rnc:                data.rnc,
    phone:              data.phone,
    address:            data.address,
    tankCapacity:       data.tankCapacity,
    alertRedGallons:    data.alertRedGallons,
    alertYellowGallons: data.alertYellowGallons,
    defaultFuelPrice:   data.defaultFuelPrice,
    ocrProvider:        data.ocrProvider as OcrProvider,
    ocrEnabled:         data.ocrEnabled,
    ocrMinConfidence:   data.ocrMinConfidence,
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const row = await prisma.systemSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...payload },
    update: payload,
  })

  // ── Read back and log (confirms what's actually in the DB) ────────────────
  const saved: SavedSettings = {
    tankCapacity:       row.tankCapacity.toNumber(),
    alertRedGallons:    row.alertRedGallons.toNumber(),
    alertYellowGallons: row.alertYellowGallons.toNumber(),
    ocrProvider:        row.ocrProvider,
    ocrEnabled:         row.ocrEnabled,
    ocrMinConfidence:   row.ocrMinConfidence,
  }
  console.log("[FuelOps/settings] Persisted in DB:", saved)

  revalidatePath("/")
  revalidatePath("/configuracion")
  revalidatePath("/inventario")
  revalidatePath("/reportes")
  revalidatePath("/suministro")
  revalidatePath("/ocr-test")

  return saved   // ← client will display this for user verification
}
