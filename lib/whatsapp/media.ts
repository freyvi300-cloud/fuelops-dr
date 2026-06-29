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

// ─── Key diagnostic helper ────────────────────────────────────────────────────

function diagnoseKey(key: string, label: string): void {
  const len         = key.length
  const startsEyJ   = key.startsWith("eyJ")
  const startsSb    = key.startsWith("sb_secret_")
  const startsBearer= key.startsWith("Bearer ")
  const first6      = key.slice(0, 6)

  console.log(`[Storage/KEY] ${label}:`)
  console.log(`[Storage/KEY]   length       : ${len} chars`)
  console.log(`[Storage/KEY]   starts "eyJ" : ${startsEyJ}  ← MUST be true for a valid JWT`)
  console.log(`[Storage/KEY]   starts "sb_" : ${startsSb}  ← new Supabase format`)
  console.log(`[Storage/KEY]   starts "Bear": ${startsBearer}  ← if true, key wrongly includes "Bearer " prefix`)
  console.log(`[Storage/KEY]   first 6 chars: "${first6}"`)

  if (len < 100) {
    console.error(`[Storage/KEY] ❌ Key is only ${len} chars — way too short.`)
    console.error(`[Storage/KEY]    A real service_role key is 200+ chars (JWT).`)
    console.error(`[Storage/KEY]    Check Vercel → Settings → Env Vars → SUPABASE_SERVICE_ROLE_KEY`)
    console.error(`[Storage/KEY]    Get it from: Supabase → Settings → API → "service_role" (NOT "anon")`)
  } else if (!startsEyJ && !startsSb) {
    console.error(`[Storage/KEY] ❌ Key does not start with "eyJ" or "sb_" — wrong key type?`)
  } else {
    console.log(`[Storage/KEY] ✅ Key format looks correct`)
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

  // Always diagnose the key before using it
  diagnoseKey(key, "SUPABASE_SERVICE_ROLE_KEY")

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

// ─── Storage path helper ──────────────────────────────────────────────────────

export function buildStoragePath(senderPhone: string, filename: string): string {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, "0")
  const d   = String(now.getDate()).padStart(2, "0")
  return `${y}/${m}/${d}/${senderPhone}/${filename}`
}
