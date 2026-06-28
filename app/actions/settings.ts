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

export async function updateSystemSettings(data: UpdateSettingsData): Promise<void> {
  if (data.tankCapacity <= 0)
    throw new Error("La capacidad del tanque debe ser mayor a cero.")
  if (data.alertRedGallons < 0 || data.alertYellowGallons < 0)
    throw new Error("Los valores de galones deben ser positivos.")
  if (data.alertRedGallons >= data.alertYellowGallons)
    throw new Error("El inventario mínimo (rojo) debe ser menor que el inventario bajo (amarillo).")
  if (data.alertYellowGallons >= data.tankCapacity)
    throw new Error("El inventario bajo (amarillo) debe ser menor que la capacidad total.")
  if (data.ocrMinConfidence < 0 || data.ocrMinConfidence > 100)
    throw new Error("La confianza mínima debe estar entre 0 y 100.")
  if (!["OPENAI","GEMINI","MOCK"].includes(data.ocrProvider))
    throw new Error("Proveedor OCR inválido.")

  await prisma.systemSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...data, ocrProvider: data.ocrProvider as OcrProvider },
    update: { ...data, ocrProvider: data.ocrProvider as OcrProvider },
  })

  revalidatePath("/")
  revalidatePath("/configuracion")
  revalidatePath("/inventario")
  revalidatePath("/reportes")
  revalidatePath("/suministro")
  revalidatePath("/ocr-test")
}
