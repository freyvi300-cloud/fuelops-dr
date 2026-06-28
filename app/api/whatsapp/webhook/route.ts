/**
 * FuelOps-DR — WhatsApp Webhook API Route
 *
 * Configure in Meta Business Suite:
 *   Webhook URL:   https://your-app.vercel.app/api/whatsapp/webhook
 *   Verify Token:  value of WHATSAPP_VERIFY_TOKEN env var
 *   Subscriptions: messages
 *
 * Environment variables required (Vercel → Settings → Environment Variables):
 *   WHATSAPP_VERIFY_TOKEN    — any secret string you choose; paste it in Meta too
 *   WHATSAPP_ACCESS_TOKEN    — from Meta → WhatsApp → API Setup
 *   WHATSAPP_PHONE_NUMBER_ID — from Meta → WhatsApp → API Setup
 */

import { NextRequest, NextResponse } from "next/server"
import { parseWebhookPayload }       from "@/lib/whatsapp/webhook"
import { handleIncomingMessage }     from "@/lib/whatsapp/commands"
import { markMessageAsRead }         from "@/lib/whatsapp/client"
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types"

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params    = req.nextUrl.searchParams
  const mode      = params.get("hub.mode")
  const token     = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!verifyToken) {
    console.error("[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not set")
    return new Response("Server misconfigured", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] ✅ Webhook verified by Meta")
    // Meta expects the challenge string as plain text, status 200
    return new Response(challenge ?? "", { status: 200 })
  }

  console.warn("[WhatsApp Webhook] ❌ Verification failed", { mode, token })
  return new Response("Forbidden", { status: 403 })
}

// ─── POST — incoming events ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as WhatsAppWebhookPayload

  // Meta sends other object types; ignore them
  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" }, { status: 200 })
  }

  // Parse all incoming messages
  const messages = parseWebhookPayload(payload)
  console.log(`[WhatsApp Webhook] Received ${messages.length} message(s)`)

  // Process each message
  // We await each one but catch errors so a single failure doesn't block others
  for (const msg of messages) {
    console.log(
      `[WhatsApp Webhook] Processing: from=${msg.from} type=${msg.type} ` +
      `text="${msg.text ?? "(non-text)"}" msgId=${msg.messageId}`
    )

    // 1. Mark as read (blue ticks) — non-critical, swallow failures
    await markMessageAsRead(msg.messageId).catch(err =>
      console.warn("[WhatsApp Webhook] markAsRead failed:", err.message)
    )

    // 2. Handle message and send reply — catch so Meta doesn't retry
    await handleIncomingMessage(msg).catch(err =>
      console.error("[WhatsApp Webhook] handleIncomingMessage failed:", err.message)
    )
  }

  // IMPORTANT: Always return 200 to Meta.
  // If we return 4xx/5xx, Meta will retry aggressively.
  return NextResponse.json({ status: "ok" }, { status: 200 })
}
