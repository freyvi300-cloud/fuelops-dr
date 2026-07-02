/**
 * POST /api/admin/backup
 *
 * Called by:
 *   - Vercel cron (daily 3 AM UTC) — Authorization: Bearer <BACKUP_SECRET>
 *
 * The UI "Crear backup ahora" button uses the triggerManualBackup() server action
 * directly (no HTTP round-trip needed).
 */

import { NextResponse }    from "next/server"
import { generateBackup }  from "@/lib/backup/generate"

export const dynamic     = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const secret = process.env.BACKUP_SECRET
  if (!secret) {
    console.error("[Backup/API] BACKUP_SECRET env var not set")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  const auth     = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth

  if (provided !== secret) {
    console.warn("[Backup/API] Unauthorized request — invalid secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await generateBackup("automatic")
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok:          true,
    storagePath: result.storagePath,
    filename:    result.filename,
    sizeBytes:   result.sizeBytes,
    tables:      result.tables,
  })
}

// Vercel cron uses GET
export async function GET(req: Request) {
  return POST(req)
}
