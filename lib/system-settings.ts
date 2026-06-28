/**
 * System-wide configurable settings.
 * Called from lib/reporting.ts, app/actions/settings.ts, and server pages.
 *
 * getSystemSettings() NEVER throws — it falls back to DEFAULTS on any DB error.
 * This prevents /configuracion and the Dashboard from crashing if the
 * SystemSettings table is missing or the row doesn't exist yet.
 */

import { prisma } from "@/lib/prisma"

export interface SystemSettings {
  businessName:      string
  rnc:               string | null
  phone:             string | null
  address:           string | null
  tankCapacity:      number   // gallons — total tank capacity
  alertRedGallons:   number   // gallons — critical alert: inventory ≤ this
  alertYellowGallons:number   // gallons — warning alert:  inventory ≤ this
  defaultFuelPrice:  number   // RD$ per gallon
}

/** Used whenever the DB row is missing or the table doesn't exist yet */
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

/** Safe Decimal-to-number conversion: returns the fallback if the value is null/undefined */
function toNum(
  val: { toNumber(): number } | null | undefined,
  fallback: number,
): number {
  if (val == null) return fallback
  try { return val.toNumber() } catch { return fallback }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    // upsert: creates the singleton row with DB defaults on first call,
    // returns the existing row on subsequent calls.
    const row = await prisma.systemSettings.upsert({
      where:  { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    })

    return {
      businessName:       row.businessName       ?? DEFAULTS.businessName,
      rnc:                row.rnc,
      phone:              row.phone,
      address:            row.address,
      tankCapacity:       toNum(row.tankCapacity,       DEFAULTS.tankCapacity),
      alertRedGallons:    toNum(row.alertRedGallons,    DEFAULTS.alertRedGallons),
      alertYellowGallons: toNum(row.alertYellowGallons, DEFAULTS.alertYellowGallons),
      defaultFuelPrice:   toNum(row.defaultFuelPrice,   DEFAULTS.defaultFuelPrice),
    }
  } catch (err) {
    // Log the root cause for debugging but don't crash the page
    console.error(
      "[FuelOps] getSystemSettings() failed — using defaults.\n" +
      "Root cause: " + (err instanceof Error ? err.message : String(err))
    )
    return DEFAULTS
  }
}
