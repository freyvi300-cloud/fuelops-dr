"use server"

import { prisma }          from "@/lib/prisma"
import { revalidatePath }  from "next/cache"
import type { SystemSettings } from "@/lib/system-settings"

export type { SystemSettings }

export interface UpdateSettingsData {
  businessName:      string
  rnc:               string | null
  phone:             string | null
  address:           string | null
  tankCapacity:      number
  alertRedGallons:   number
  alertYellowGallons:number
  defaultFuelPrice:  number
}

export async function updateSystemSettings(data: UpdateSettingsData): Promise<void> {
  // Validate threshold order
  if (data.alertRedGallons < 0 || data.alertYellowGallons < 0 || data.tankCapacity <= 0) {
    throw new Error("Los valores de galones deben ser positivos.")
  }
  if (data.alertRedGallons >= data.alertYellowGallons) {
    throw new Error(
      "El inventario mínimo (alerta roja) debe ser menor que el inventario bajo (alerta amarilla)."
    )
  }
  if (data.alertYellowGallons >= data.tankCapacity) {
    throw new Error(
      "El inventario bajo (alerta amarilla) debe ser menor que la capacidad total del tanque."
    )
  }

  await prisma.systemSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  })

  // Revalidate all pages that use settings
  revalidatePath("/")
  revalidatePath("/configuracion")
  revalidatePath("/inventario")
  revalidatePath("/reportes")
}
