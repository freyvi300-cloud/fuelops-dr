/**
 * FuelOps-DR — Backup generation
 *
 * Exports all DB tables as JSON, packages into a ZIP, uploads to Supabase Storage.
 * Bucket `backups` is PRIVATE — no public URL is returned; use signed URLs via
 * lib/backup/storage.ts to download.
 *
 * Paths:
 *   manual/backup-manual-YYYY-MM-DDTHH-mm-ss.zip
 *   automatic/backup-auto-YYYY-MM-DDTHH-mm-ss.zip
 */

import JSZip      from "jszip"
import { prisma } from "@/lib/prisma"
import { supabaseUpload } from "@/lib/backup/storage"

export const BACKUP_BUCKET = "backups"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupResult {
  ok:          true
  storagePath: string   // path inside bucket (no public URL — bucket is private)
  filename:    string
  sizeBytes:   number
  tables:      Record<string, number>
}

export interface BackupError {
  ok:    false
  error: string
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateBackup(
  mode: "manual" | "automatic" = "manual",
): Promise<BackupResult | BackupError> {
  try {
    // ── 1. Fetch all tables ───────────────────────────────────────────────────
    const [
      customers,
      trucks,
      inventoryMovements,
      supplies,
      invoices,
      payments,
      systemSettings,
      whatsappImages,
      whatsappConversations,
    ] = await Promise.all([
      prisma.customer.findMany(),
      prisma.truck.findMany(),
      prisma.inventoryMovement.findMany(),
      // Exclude meterPhotoB64 — raw base64 blobs are multi-MB each and already
      // stored in Supabase Storage (whatsapp-images bucket).
      prisma.supply.findMany({
        select: {
          id: true, customerId: true, truckId: true,
          gallons: true, pricePerGallon: true, total: true,
          paymentType: true, notes: true, suppliedAt: true, createdAt: true,
        },
      }),
      prisma.invoice.findMany(),
      prisma.payment.findMany(),
      prisma.systemSettings.findMany(),
      prisma.whatsAppImage.findMany({
        select: {
          id: true, mediaId: true, senderPhone: true, senderName: true,
          storageUrl: true, mimeType: true, caption: true, createdAt: true,
          ocrGallons: true, ocrConfidence: true, ocrQuality: true,
          ocrNotes: true, ocrProvider: true, ocrProcessedAt: true,
          // ocrRawText excluded — can be very large JSON blobs
        },
      }),
      prisma.whatsAppConversation.findMany(),
    ])

    const tables = {
      customers:             customers.length,
      trucks:                trucks.length,
      inventoryMovements:    inventoryMovements.length,
      supplies:              supplies.length,
      invoices:              invoices.length,
      payments:              payments.length,
      systemSettings:        systemSettings.length,
      whatsappImages:        whatsappImages.length,
      whatsappConversations: whatsappConversations.length,
    }

    // ── 2. Build ZIP ──────────────────────────────────────────────────────────
    const zip = new JSZip()
    const now = new Date()
    const ts  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)

    const manifest = {
      generatedAt: now.toISOString(),
      mode,
      version: "2.0",
      tables,
    }

    zip.file("manifest.json",               JSON.stringify(manifest,               null, 2))
    zip.file("customers.json",              JSON.stringify(customers,              null, 2))
    zip.file("trucks.json",                 JSON.stringify(trucks,                 null, 2))
    zip.file("inventory_movements.json",    JSON.stringify(inventoryMovements,     null, 2))
    zip.file("supplies.json",               JSON.stringify(supplies,               null, 2))
    zip.file("invoices.json",               JSON.stringify(invoices,               null, 2))
    zip.file("payments.json",               JSON.stringify(payments,               null, 2))
    zip.file("system_settings.json",        JSON.stringify(systemSettings,         null, 2))
    zip.file("whatsapp_images.json",        JSON.stringify(whatsappImages,         null, 2))
    zip.file("whatsapp_conversations.json", JSON.stringify(whatsappConversations,  null, 2))

    const zipBuffer = await zip.generateAsync({
      type:               "nodebuffer",
      compression:        "DEFLATE",
      compressionOptions: { level: 6 },
    })

    // ── 3. Upload to Supabase Storage (private bucket) ────────────────────────
    const label      = mode === "manual" ? "manual" : "auto"
    const filename   = `backup-${label}-${ts}.zip`
    const storagePath = `${mode}/${filename}`

    await supabaseUpload(BACKUP_BUCKET, storagePath, zipBuffer, "application/zip")

    console.log(`[Backup] ✅ ${mode} backup → ${storagePath}  tables:`, tables)

    return { ok: true, storagePath, filename, sizeBytes: zipBuffer.length, tables }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Backup] ❌ Error:", msg)
    return { ok: false, error: msg }
  }
}
