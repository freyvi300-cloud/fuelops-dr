/**
 * FuelOps-DR — Backup restore
 *
 * Downloads a ZIP from Supabase Storage (private bucket), parses the JSON files,
 * and restores the DB in a safe order using a Prisma transaction.
 *
 * Safety protocol:
 *   1. Validate storagePath (no path traversal, must be .zip, must be in backups bucket)
 *   2. Auto-generate a pre-restore safety backup
 *   3. Delete all existing records in reverse FK order
 *   4. Re-create all records in FK order
 *   5. Return per-table counts
 */

import JSZip      from "jszip"
import { prisma } from "@/lib/prisma"
import { supabaseDownload } from "@/lib/backup/storage"
import { generateBackup }   from "@/lib/backup/generate"
import { BACKUP_BUCKET }    from "@/lib/backup/generate"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RestoreResult {
  ok:           true
  safetyBackup: string  // storagePath of the pre-restore backup
  restored:     Record<string, number>
}

export interface RestoreError {
  ok:    false
  error: string
}

// ─── Path validation ──────────────────────────────────────────────────────────

function validateStoragePath(storagePath: string): void {
  // Must end with .zip
  if (!storagePath.endsWith(".zip")) {
    throw new Error("El archivo debe ser un .zip")
  }
  // Reject path traversal attempts
  if (storagePath.includes("..") || storagePath.includes("//") || storagePath.startsWith("/")) {
    throw new Error("Ruta de archivo inválida")
  }
  // Must be under manual/ or automatic/ prefix
  if (!storagePath.startsWith("manual/") && !storagePath.startsWith("automatic/")) {
    throw new Error("El backup debe estar en manual/ o automatic/ dentro del bucket backups")
  }
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

// Decimal fields are serialized as strings by Prisma — pass them straight back.
// Date fields serialized as ISO strings — convert to Date objects.

type AnyRecord = Record<string, unknown>

function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (typeof v === "string") return new Date(v)
  throw new Error(`Cannot convert to Date: ${v}`)
}

function parseDates<T extends AnyRecord>(
  rows: T[],
  dateFields: (keyof T)[],
): T[] {
  return rows.map(row => {
    const out = { ...row }
    for (const f of dateFields) {
      if (out[f] !== null && out[f] !== undefined) {
        (out as AnyRecord)[f as string] = toDate(out[f])
      }
    }
    return out
  })
}

// ─── Main restore function ────────────────────────────────────────────────────

export async function restoreFromBackup(
  storagePath: string,
): Promise<RestoreResult | RestoreError> {
  try {
    // ── 0. Validate ───────────────────────────────────────────────────────────
    validateStoragePath(storagePath)

    // ── 1. Pre-restore safety backup ─────────────────────────────────────────
    console.log("[Restore] Creating pre-restore safety backup…")
    const safety = await generateBackup("manual")
    if (!safety.ok) {
      return { ok: false, error: `No se pudo crear el backup de seguridad previo: ${safety.error}` }
    }
    const safetyPath = safety.storagePath
    console.log(`[Restore] Safety backup → ${safetyPath}`)

    // ── 2. Download ZIP from Supabase ─────────────────────────────────────────
    console.log(`[Restore] Downloading ${BACKUP_BUCKET}/${storagePath}…`)
    const buffer = await supabaseDownload(BACKUP_BUCKET, storagePath)

    // ── 3. Parse ZIP ──────────────────────────────────────────────────────────
    const zip = await JSZip.loadAsync(buffer)

    async function readJson<T>(filename: string): Promise<T[]> {
      const file = zip.file(filename)
      if (!file) {
        console.warn(`[Restore] ${filename} not found in ZIP — skipping`)
        return []
      }
      const text = await file.async("text")
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed as T[] : []
    }

    const [
      systemSettingsRaw,
      customersRaw,
      trucksRaw,
      inventoryMovementsRaw,
      suppliesRaw,
      invoicesRaw,
      paymentsRaw,
      whatsappImagesRaw,
      whatsappConversationsRaw,
    ] = await Promise.all([
      readJson<AnyRecord>("system_settings.json"),
      readJson<AnyRecord>("customers.json"),
      readJson<AnyRecord>("trucks.json"),
      readJson<AnyRecord>("inventory_movements.json"),
      readJson<AnyRecord>("supplies.json"),
      readJson<AnyRecord>("invoices.json"),
      readJson<AnyRecord>("payments.json"),
      readJson<AnyRecord>("whatsapp_images.json"),
      readJson<AnyRecord>("whatsapp_conversations.json"),
    ])

    // Parse date fields
    const customers       = parseDates(customersRaw,       ["createdAt", "updatedAt"])
    const trucks          = parseDates(trucksRaw,          ["createdAt", "updatedAt"])
    const inventoryMovs   = parseDates(inventoryMovementsRaw, ["movedAt", "createdAt"])
    const supplies        = parseDates(suppliesRaw,        ["suppliedAt", "createdAt"])
    const invoices        = parseDates(invoicesRaw,        ["issueDate", "dueDate", "createdAt", "updatedAt"])
    const payments        = parseDates(paymentsRaw,        ["paymentDate", "createdAt", "updatedAt"])
    const waImages        = parseDates(whatsappImagesRaw,  ["createdAt", "ocrProcessedAt"])
    const waConversations = parseDates(whatsappConversationsRaw, ["createdAt", "updatedAt", "expiresAt"])

    // ── 4. Restore inside a Prisma transaction ────────────────────────────────
    // Delete in reverse FK order, then create in FK order.
    // timeout=60s to handle large datasets.

    console.log("[Restore] Running DB transaction…")

    await prisma.$transaction(async (tx) => {
      // DELETE in reverse FK order
      await tx.whatsAppConversation.deleteMany()
      await tx.whatsAppImage.deleteMany()
      await tx.payment.deleteMany()
      await tx.invoice.deleteMany()
      await tx.supply.deleteMany()
      await tx.inventoryMovement.deleteMany()
      await tx.truck.deleteMany()
      await tx.customer.deleteMany()
      await tx.systemSettings.deleteMany()

      // CREATE in FK order — cast via unknown to avoid complex Prisma parameter inference
      /* eslint-disable @typescript-eslint/no-explicit-any */
      if (systemSettingsRaw.length)
        await tx.systemSettings.createMany({ data: systemSettingsRaw as any, skipDuplicates: true })
      if (customers.length)
        await tx.customer.createMany({ data: customers as any, skipDuplicates: true })
      if (trucks.length)
        await tx.truck.createMany({ data: trucks as any, skipDuplicates: true })
      if (inventoryMovs.length)
        await tx.inventoryMovement.createMany({ data: inventoryMovs as any, skipDuplicates: true })
      if (supplies.length)
        await tx.supply.createMany({ data: supplies as any, skipDuplicates: true })
      if (invoices.length)
        await tx.invoice.createMany({ data: invoices as any, skipDuplicates: true })
      if (payments.length)
        await tx.payment.createMany({ data: payments as any, skipDuplicates: true })
      if (waImages.length)
        await tx.whatsAppImage.createMany({ data: waImages as any, skipDuplicates: true })
      if (waConversations.length)
        await tx.whatsAppConversation.createMany({ data: waConversations as any, skipDuplicates: true })
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }, { timeout: 60_000 })

    const restored = {
      systemSettings:        systemSettingsRaw.length,
      customers:             customers.length,
      trucks:                trucks.length,
      inventoryMovements:    inventoryMovs.length,
      supplies:              supplies.length,
      invoices:              invoices.length,
      payments:              payments.length,
      whatsappImages:        waImages.length,
      whatsappConversations: waConversations.length,
    }

    console.log("[Restore] ✅ Done. Restored:", restored)
    return { ok: true, safetyBackup: safetyPath, restored }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Restore] ❌ Error:", msg)
    return { ok: false, error: msg }
  }
}
