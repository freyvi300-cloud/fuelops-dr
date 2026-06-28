/**
 * System-wide configurable settings.
 * Called from lib/reporting.ts (non-server), app/actions/settings.ts, and pages.
 * Uses upsert so the singleton row is auto-created with defaults on first access.
 */

import { prisma } from "@/lib/prisma"

export interface SystemSettings {
  businessName:      string
  rnc:               string | null
  phone:             string | null
  address:           string | null
  tankCapacity:      number   // gallons — total capacity of the main tank
  alertRedGallons:   number   // gallons — critical alert: inventory ≤ this
  alertYellowGallons:number   // gallons — warning alert:  inventory ≤ this
  defaultFuelPrice:  number   // RD$ per gallon (default for new customers)
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
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const row = await prisma.systemSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton" },   // DB defaults fill the rest
    update: {},                    // never overwrite on read
  })
  return {
    businessName:       row.businessName,
    rnc:                row.rnc,
    phone:              row.phone,
    address:            row.address,
    tankCapacity:       row.tankCapacity.toNumber(),
    alertRedGallons:    row.alertRedGallons.toNumber(),
    alertYellowGallons: row.alertYellowGallons.toNumber(),
    defaultFuelPrice:   row.defaultFuelPrice.toNumber(),
  }
}
