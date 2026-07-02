"use server"

import { generateBackup } from "@/lib/backup/generate"

export interface BackupActionResult {
  ok:        boolean
  url?:      string
  filename?: string
  sizeBytes?: number
  tables?:   Record<string, number>
  error?:    string
}

export async function triggerManualBackup(): Promise<BackupActionResult> {
  const result = await generateBackup()

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return {
    ok:        true,
    url:       result.url,
    filename:  result.filename,
    sizeBytes: result.sizeBytes,
    tables:    result.tables,
  }
}
