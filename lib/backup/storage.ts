/**
 * FuelOps-DR — Supabase Storage helpers for the backup bucket.
 * All operations use SUPABASE_SERVICE_ROLE_KEY — server-side only.
 */

import { BACKUP_BUCKET } from "@/lib/backup/generate"

// ─── Env helpers ──────────────────────────────────────────────────────────────

function supabaseEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL              ?? ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!url || !key) {
    throw new Error(
      `Supabase no configurado. ` +
      `SUPABASE_URL: ${url ? "SET" : "MISSING"}, ` +
      `SUPABASE_SERVICE_ROLE_KEY: ${key ? "SET" : "MISSING"}`,
    )
  }
  return { url, key }
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function supabaseUpload(
  bucket:      string,
  storagePath: string,
  buffer:      Buffer,
  contentType: string,
): Promise<void> {
  const { url, key } = supabaseEnv()
  const uploadUrl = `${url}/storage/v1/object/${bucket}/${storagePath}`

  const res = await fetch(uploadUrl, {
    method:  "POST",
    headers: { ...authHeaders(key), "Content-Type": contentType, "x-upsert": "true" },
    body:    new Uint8Array(buffer),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    throw new Error(`Supabase upload HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
}

// ─── Download (buffer) ────────────────────────────────────────────────────────

export async function supabaseDownload(
  bucket:      string,
  storagePath: string,
): Promise<Buffer> {
  const { url, key } = supabaseEnv()
  const downloadUrl = `${url}/storage/v1/object/${bucket}/${storagePath}`

  const res = await fetch(downloadUrl, {
    headers: authHeaders(key),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    throw new Error(`Supabase download HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// ─── Signed URL (10-minute expiry) ───────────────────────────────────────────

export async function getSignedUrl(
  bucket:      string,
  storagePath: string,
  expiresIn    = 600,  // seconds
): Promise<string> {
  const { url, key } = supabaseEnv()
  const signUrl = `${url}/storage/v1/object/sign/${bucket}/${storagePath}`

  const res = await fetch(signUrl, {
    method:  "POST",
    headers: { ...authHeaders(key), "Content-Type": "application/json" },
    body:    JSON.stringify({ expiresIn }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    throw new Error(`Supabase sign HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json() as { signedURL?: string; error?: string }
  if (!data.signedURL) {
    throw new Error(`No signedURL in response: ${JSON.stringify(data).slice(0, 200)}`)
  }

  // Supabase returns a relative path like /storage/v1/object/sign/...
  return data.signedURL.startsWith("http") ? data.signedURL : `${url}${data.signedURL}`
}

// ─── List backup files ────────────────────────────────────────────────────────

export interface BackupFile {
  storagePath: string
  filename:    string
  sizeBytes:   number | null
  createdAt:   string | null  // ISO string
  type:        "manual" | "automatic" | "unknown"
}

type SupabaseObject = {
  name:       string
  id:         string | null
  metadata?:  { size?: number; mimetype?: string; lastModified?: string } | null
  created_at?: string | null
  updated_at?: string | null
}

async function listPrefix(
  bucket: string,
  prefix: string,
  limit:  number,
): Promise<BackupFile[]> {
  const { url, key } = supabaseEnv()
  const listUrl = `${url}/storage/v1/object/list/${bucket}`

  const res = await fetch(listUrl, {
    method:  "POST",
    headers: { ...authHeaders(key), "Content-Type": "application/json" },
    body:    JSON.stringify({
      prefix,
      limit,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    console.error(`[BackupList] list ${prefix} HTTP ${res.status}: ${body.slice(0, 200)}`)
    return []
  }

  const items = await res.json() as SupabaseObject[]
  if (!Array.isArray(items)) return []

  return items
    .filter(obj => obj.name.endsWith(".zip") && obj.id !== null)
    .map(obj => {
      const fullPath = prefix ? `${prefix}/${obj.name}` : obj.name
      return {
        storagePath: fullPath,
        filename:    obj.name,
        sizeBytes:   obj.metadata?.size ?? null,
        createdAt:   obj.created_at ?? obj.updated_at ?? null,
        type:        prefix === "manual"    ? "manual"
                   : prefix === "automatic" ? "automatic"
                   : "unknown",
      } satisfies BackupFile
    })
}

/** List up to `limit` most-recent backups from manual + automatic prefixes. */
export async function listBackups(limit = 20): Promise<BackupFile[]> {
  const [manual, automatic] = await Promise.all([
    listPrefix(BACKUP_BUCKET, "manual",    limit),
    listPrefix(BACKUP_BUCKET, "automatic", limit),
  ])

  return [...manual, ...automatic]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta   // newest first
    })
    .slice(0, limit)
}
