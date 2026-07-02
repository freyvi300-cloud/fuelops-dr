/**
 * POST /api/admin/backup
 *
 * Protected endpoint called by:
 *   - Vercel cron (daily) — sends Authorization: Bearer <BACKUP_SECRET>
 *   - Manual trigger from the UI (via server action that calls this internally)
 *
 * Security: rejects any request without the correct BACKUP_SECRET header.
 */

import { NextResponse } from "next/server"
import { generateBackup } from "@/lib/backup/generate"

export const dynamic = "force-dynamic"
export const maxDuration = 60  // ZIP generation + upload can take ~15s

export async function POST(req: Request) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const secret = process.env.BACKUP_SECRET
  if (!secret) {
    console.error("[Backup/API] BACKUP_SECRET env var not set")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  const auth = req.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth

  if (provided !== secret) {
    console.warn("[Backup/API] Unauthorized request — invalid secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Generate and upload ─────────────────────────────────────────────────────
  const result = await generateBackup()

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok:        true,
    url:       result.url,
    filename:  result.filename,
    sizeBytes: result.sizeBytes,
    tables:    result.tables,
  })
}

// Vercel cron also sends GET — redirect to POST to allow future webhook-style pings
export async function GET(req: Request) {
  return POST(req)
}
