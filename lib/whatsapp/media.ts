/**
 * FuelOps-DR — WhatsApp Image Storage + DB Persistence
 *
 * Upload received WhatsApp images to Supabase Storage and record metadata in DB.
 *
 * Required env vars (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL              — https://{project_ref}.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase → Settings → API → Service role key
 *
 * Required Supabase setup (one-time, in Supabase dashboard):
 *   Storage → New bucket → Name: "whatsapp-images" → Public: YES
 */

import { prisma } from "@/lib/prisma"

const BUCKET = "whatsapp-images"

// ─── Supabase Storage upload ──────────────────────────────────────────────────

export async function uploadToSupabase(
  buffer:   Buffer,
  mimeType: string,
  path:     string,          // e.g. "2026/06/28/18095551234/mediaId.jpg"
): Promise<string> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Supabase Storage no configurado. Agrega SUPABASE_URL y " +
      "SUPABASE_SERVICE_ROLE_KEY en Vercel → Settings → Environment Variables."
    )
  }

  const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${path}`
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`

  console.log(`[Storage/UP] Uploading ${buffer.length}B to ${BUCKET}/${path}`)
  console.log(`[Storage/UP] Endpoint: POST ${url}/storage/v1/object/${BUCKET}/...`)
  console.log(`[Storage/UP] SUPABASE_URL set: ${Boolean(url)} | SERVICE_KEY set: ${Boolean(key)} (${key.length} chars)`)

  try {
    const res = await fetch(uploadUrl, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  mimeType,
        "x-upsert":      "true",
      },
      body: new Uint8Array(buffer),
    })

    console.log(`[Storage/UP] HTTP ${res.status} ${res.statusText}`)

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)")
      console.error(`[Storage/UP] ❌ Response body: ${body}`)
      throw new Error(`Supabase Storage HTTP ${res.status}: ${body.slice(0, 300)}`)
    }

    const responseBody = await res.text().catch(() => "")
    console.log(`[Storage/UP] ✅ Success. Response: ${responseBody.slice(0, 200)}`)
    console.log(`[Storage/UP] Public URL: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    const e = err as Error
    console.error(`[Storage/UP] ❌ FAILED`)
    console.error(`[Storage/UP] message : ${e.message}`)
    console.error(`[Storage/UP] cause   : ${String((e as NodeJS.ErrnoException).cause ?? "none")}`)
    console.error(`[Storage/UP] stack   : ${e.stack ?? "no stack"}`)
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
    update: {},   // idempotent — don't overwrite if already processed
  })
  console.log(`[Storage] ✅ DB record saved: mediaId=${data.mediaId}`)
}

// ─── Storage path helper ──────────────────────────────────────────────────────

export function buildStoragePath(
  senderPhone: string,
  filename:    string,
): string {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, "0")
  const d   = String(now.getDate()).padStart(2, "0")
  return `${y}/${m}/${d}/${senderPhone}/${filename}`
}
