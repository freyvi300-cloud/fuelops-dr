/**
 * FuelOps-DR — Backup generation
 *
 * Exports all DB tables as JSON, packages into a ZIP, uploads to Supabase Storage.
 * Called from:
 *   - /api/admin/backup  (Vercel cron + manual via BACKUP_SECRET)
 *   - app/actions/backup.ts (UI "Crear backup ahora" button)
 */

import JSZip   from "jszip"
import { prisma } from "@/lib/prisma"

const BUCKET = "backups"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupResult {
  ok:        true
  url:       string
  filename:  string
  sizeBytes: number
  tables:    Record<string, number>
}

export interface BackupError {
  ok:      false
  error:   string
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateBackup(): Promise<BackupResult | BackupError> {
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
      // stored in Supabase Storage (whatsapp-images bucket). Include the metadata.
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
    const zip  = new JSZip()
    const now  = new Date()
    const ts   = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)  // 2026-07-02T14-30-00

    const manifest = {
      generatedAt: now.toISOString(),
      version:     "1.0",
      tables,
    }

    zip.file("manifest.json",             JSON.stringify(manifest,             null, 2))
    zip.file("customers.json",            JSON.stringify(customers,            null, 2))
    zip.file("trucks.json",               JSON.stringify(trucks,               null, 2))
    zip.file("inventory_movements.json",  JSON.stringify(inventoryMovements,   null, 2))
    zip.file("supplies.json",             JSON.stringify(supplies,             null, 2))
    zip.file("invoices.json",             JSON.stringify(invoices,             null, 2))
    zip.file("payments.json",             JSON.stringify(payments,             null, 2))
    zip.file("system_settings.json",      JSON.stringify(systemSettings,       null, 2))
    zip.file("whatsapp_images.json",      JSON.stringify(whatsappImages,       null, 2))
    zip.file("whatsapp_conversations.json", JSON.stringify(whatsappConversations, null, 2))

    const zipBuffer = await zip.generateAsync({
      type:               "nodebuffer",
      compression:        "DEFLATE",
      compressionOptions: { level: 6 },
    })

    // ── 3. Upload to Supabase Storage ─────────────────────────────────────────
    const supabaseUrl = process.env.SUPABASE_URL              ?? ""
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

    if (!supabaseUrl || !serviceKey) {
      return {
        ok:    false,
        error: `Supabase no configurado. SUPABASE_URL: ${supabaseUrl ? "SET" : "MISSING"}, SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? "SET" : "MISSING"}`,
      }
    }

    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    const filename  = `backup-${ts}.zip`
    const storagePath = `${y}/${m}/${d}/${filename}`
    const uploadUrl   = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`
    const publicUrl   = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`

    console.log(`[Backup] Uploading ${zipBuffer.length}B → ${BUCKET}/${storagePath}`)

    const res = await fetch(uploadUrl, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${serviceKey}`,
        apikey:         serviceKey,
        "Content-Type": "application/zip",
        "x-upsert":     "true",
      },
      body: new Uint8Array(zipBuffer),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)")
      return { ok: false, error: `Supabase upload HTTP ${res.status}: ${body.slice(0, 300)}` }
    }

    console.log(`[Backup] ✅ Uploaded. Tables: ${JSON.stringify(tables)}`)

    return {
      ok:        true,
      url:       publicUrl,
      filename,
      sizeBytes: zipBuffer.length,
      tables,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Backup] ❌ Error:", msg)
    return { ok: false, error: msg }
  }
}
