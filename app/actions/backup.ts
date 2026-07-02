"use server"

import { generateBackup }  from "@/lib/backup/generate"
import { getSignedUrl, listBackups } from "@/lib/backup/storage"
import { restoreFromBackup }         from "@/lib/backup/restore"
import { BACKUP_BUCKET }             from "@/lib/backup/generate"
import type { BackupFile }           from "@/lib/backup/storage"
import { revalidatePath }            from "next/cache"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupActionResult {
  ok:          boolean
  storagePath?: string
  filename?:   string
  sizeBytes?:  number
  tables?:     Record<string, number>
  error?:      string
}

export interface BackupListResult {
  ok:     boolean
  files?: BackupFile[]
  error?: string
}

export interface SignedUrlResult {
  ok:     boolean
  url?:   string
  error?: string
}

export interface RestoreActionResult {
  ok:           boolean
  safetyBackup?: string
  restored?:    Record<string, number>
  error?:       string
}

// ─── Create manual backup ─────────────────────────────────────────────────────

export async function triggerManualBackup(): Promise<BackupActionResult> {
  const result = await generateBackup("manual")
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok:          true,
    storagePath: result.storagePath,
    filename:    result.filename,
    sizeBytes:   result.sizeBytes,
    tables:      result.tables,
  }
}

// ─── List backup files ────────────────────────────────────────────────────────

export async function listBackupFiles(): Promise<BackupListResult> {
  try {
    const files = await listBackups(20)
    return { ok: true, files }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ─── Generate signed download URL ────────────────────────────────────────────

export async function getSignedDownloadUrl(
  storagePath: string,
): Promise<SignedUrlResult> {
  // Validate path before signing
  if (!storagePath.endsWith(".zip")) {
    return { ok: false, error: "Archivo inválido" }
  }
  if (storagePath.includes("..") || storagePath.startsWith("/")) {
    return { ok: false, error: "Ruta inválida" }
  }

  try {
    const url = await getSignedUrl(BACKUP_BUCKET, storagePath, 600) // 10 min
    return { ok: true, url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ─── Restore from backup ──────────────────────────────────────────────────────

export async function restoreBackupAction(
  storagePath: string,
): Promise<RestoreActionResult> {
  const result = await restoreFromBackup(storagePath)

  if (!result.ok) return { ok: false, error: result.error }

  // Revalidate all pages so fresh data is shown immediately after restore
  revalidatePath("/", "layout")

  return {
    ok:           true,
    safetyBackup: result.safetyBackup,
    restored:     result.restored,
  }
}
