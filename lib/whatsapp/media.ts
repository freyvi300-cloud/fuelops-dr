/**
 * FuelOps-DR — WhatsApp Image Storage + DB Persistence
 *
 * Required env vars (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL              — https://{project_ref}.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase → Settings → API → "service_role" key
 *                               Must be a JWT (~200+ chars, starts with "eyJ")
 *                               NOT the anon key, NOT the project password, NOT publishable key
 */

import { prisma } from "@/lib/prisma"

const BUCKET = "whatsapp-images"

// ─── Environment variable audit ──────────────────────────────────────────────

function auditEnvVars(): void {
  // List every variable name that could be relevant — prints name + length only
  const candidates = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_KEY",
    "SUPABASE_SECRET",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]

  console.log("[Storage/ENV] ── All Supabase-related env vars ──")
  for (const name of candidates) {
    const val = process.env[name]
    if (val !== undefined) {
      const len        = val.length
      const startsEyJ  = val.startsWith("eyJ")
      const startsSb   = val.startsWith("sb_")
      const first6     = val.slice(0, 6)
      console.log(`[Storage/ENV]   ${name.padEnd(35)} → ${len} chars | starts:"${first6}" | eyJ:${startsEyJ} | sb_:${startsSb}`)
    } else {
      console.log(`[Storage/ENV]   ${name.padEnd(35)} → NOT SET`)
    }
  }

  // Explicit check on the variable we actually use
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  console.log(`[Storage/ENV] ── Using: SUPABASE_SERVICE_ROLE_KEY (${key.length} chars) ──`)
  if (key.length < 100) {
    console.error(`[Storage/ENV] ❌ SUPABASE_SERVICE_ROLE_KEY is ${key.length} chars — too short for a JWT.`)
    console.error(`[Storage/ENV]    Expected: 200+ chars starting with "eyJ"`)
    console.error(`[Storage/ENV]    Get it: Supabase → Settings → API → "service_role" (NOT "anon")`)
  }
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

export async function uploadToSupabase(
  buffer:   Buffer,
  mimeType: string,
  path:     string,
): Promise<string> {
  const url = process.env.SUPABASE_URL              ?? ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

  if (!url || !key) {
    throw new Error(
      "Supabase Storage no configurado. " +
      `SUPABASE_URL: ${url ? "SET" : "MISSING"}, ` +
      `SUPABASE_SERVICE_ROLE_KEY: ${key ? "SET" : "MISSING"}`
    )
  }

  // Audit all Supabase env vars before using them
  auditEnvVars()

  const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${path}`
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`

  console.log(`[Storage/UP] Uploading ${buffer.length}B → ${BUCKET}/${path}`)
  console.log(`[Storage/UP] POST ${url}/storage/v1/object/${BUCKET}/...`)
  console.log(`[Storage/UP] Headers: Authorization: Bearer <key>, apikey: <key>, Content-Type: ${mimeType}`)

  try {
    const res = await fetch(uploadUrl, {
      method:  "POST",
      headers: {
        // Supabase Storage requires BOTH headers:
        // - Authorization: Bearer for RLS/policy checks
        // - apikey: for project identification
        "Authorization": `Bearer ${key}`,
        "apikey":        key,
        "Content-Type":  mimeType,
        "x-upsert":      "true",
      },
      body: new Uint8Array(buffer),
    })

    const bodyText = await res.text().catch(() => "(unreadable)")
    console.log(`[Storage/UP] HTTP ${res.status} ${res.statusText}`)
    console.log(`[Storage/UP] Response: ${bodyText.slice(0, 300)}`)

    if (!res.ok) {
      throw new Error(`Supabase HTTP ${res.status}: ${bodyText.slice(0, 300)}`)
    }

    console.log(`[Storage/UP] ✅ Uploaded. Public URL: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    const e = err as Error
    console.error(`[Storage/UP] ❌ FAILED: ${e.message}`)
    console.error(`[Storage/UP] cause: ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[Storage/UP] stack: ${e.stack ?? "no stack"}`)
    throw e
  }
}

// ─── DB persistence ───────────────────────────────────────────────────────────

export interface WhatsAppImageRecord {
  mediaId:     string
  senderPhone: string
  senderName:  string | null
  storageUrl:  string
  mimeType:    string | null
  caption:     string | null
}

export async function saveWhatsAppImageRecord(
  data: WhatsAppImageRecord,
): Promise<void> {
  await prisma.whatsAppImage.upsert({
    where:  { mediaId: data.mediaId },
    create: data,
    update: {},
  })
  console.log(`[Storage/DB] ✅ Saved: mediaId=${data.mediaId}`)
}

// ─── Save OCR result (Phase 3.2) ─────────────────────────────────────────────

export interface OcrUpdateData {
  ocrGallons:    number | null
  ocrConfidence: number
  ocrQuality:    string
  ocrNotes:      string
  ocrProvider:   string
  ocrRawText:    string
}

export async function updateOcrResult(
  mediaId: string,
  ocr:     OcrUpdateData,
): Promise<void> {
  await prisma.whatsAppImage.update({
    where: { mediaId },
    data: {
      ocrGallons:     ocr.ocrGallons,
      ocrConfidence:  ocr.ocrConfidence,
      ocrQuality:     ocr.ocrQuality,
      ocrNotes:       ocr.ocrNotes,
      ocrProvider:    ocr.ocrProvider,
      ocrRawText:     ocr.ocrRawText,
      ocrProcessedAt: new Date(),
    },
  })
  console.log(
    `[Storage/DB] ✅ OCR saved: mediaId=${mediaId} gallons=${ocr.ocrGallons} ` +
    `confidence=${ocr.ocrConfidence}% quality=${ocr.ocrQuality}`
  )
}

// ─── Storage path helper ──────────────────────────────────────────────────────

export function buildStoragePath(senderPhone: string, filename: string): string {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, "0")
  const d   = String(now.getDate()).padStart(2, "0")
  return `${y}/${m}/${d}/${senderPhone}/${filename}`
}
