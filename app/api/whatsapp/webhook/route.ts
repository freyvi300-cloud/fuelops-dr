/**
 * FuelOps-DR — WhatsApp Webhook
 * GET  → Meta verification
 * POST → incoming messages from WhatsApp
 *
 * Required env vars (Vercel → Settings → Environment Variables):
 *   WHATSAPP_VERIFY_TOKEN    — token you set in Meta webhook settings
 *   WHATSAPP_ACCESS_TOKEN    — Meta API access token
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

  console.log("[WhatsApp GET] Verification attempt:", { mode, token, challenge })

  if (!verifyToken) {
    console.error("[WhatsApp GET] ❌ WHATSAPP_VERIFY_TOKEN is not set in environment")
    return new Response("Server misconfigured — WHATSAPP_VERIFY_TOKEN missing", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp GET] ✅ Webhook verified successfully")
    return new Response(challenge ?? "", { status: 200 })
  }

  console.warn("[WhatsApp GET] ❌ Verification failed", {
    expected: verifyToken,
    received: token,
    mode,
  })
  return new Response("Forbidden", { status: 403 })
}

// ─── POST — incoming events from Meta ────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Log #1 — the very first thing, proves the function was invoked
  console.log("[WhatsApp POST] ▶ Request received at", new Date().toISOString())
  console.log("[WhatsApp POST] Headers:", Object.fromEntries(req.headers))

  // Return 200 immediately registered — parse + handle async below
  // (Meta retries if it doesn't get 200 within 20 seconds)

  let rawBody = ""
  try {
    rawBody = await req.text()
    console.log("[WhatsApp POST] Raw body length:", rawBody.length, "chars")
    console.log("[WhatsApp POST] Raw body:", rawBody.slice(0, 2000)) // first 2000 chars
  } catch (err) {
    console.error("[WhatsApp POST] ❌ Failed to read body:", err)
    return NextResponse.json({ status: "error", error: "Failed to read body" }, { status: 200 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    console.error("[WhatsApp POST] ❌ Body is not valid JSON:", rawBody.slice(0, 200))
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 200 })
  }

  const payload = body as WhatsAppWebhookPayload
  console.log("[WhatsApp POST] object field:", payload.object)
  console.log("[WhatsApp POST] entry count:", payload.entry?.length ?? 0)

  // Meta sends other object types (status updates for templates, etc.) — ignore them
  if (payload.object !== "whatsapp_business_account") {
    console.log("[WhatsApp POST] Ignoring non-whatsapp object:", payload.object)
    return NextResponse.json({ status: "ignored" }, { status: 200 })
  }

  // Log entry details
  for (const entry of payload.entry ?? []) {
    console.log("[WhatsApp POST] Entry ID:", entry.id, "| Changes:", entry.changes?.length ?? 0)
    for (const change of entry.changes ?? []) {
      console.log("[WhatsApp POST] Change field:", change.field, "| messages:", change.value?.messages?.length ?? 0, "| statuses:", change.value?.statuses?.length ?? 0)
    }
  }

  // Parse messages
  let messages
  try {
    messages = parseWebhookPayload(payload)
    console.log("[WhatsApp POST] Parsed", messages.length, "message(s)")
  } catch (err) {
    console.error("[WhatsApp POST] ❌ parseWebhookPayload threw:", err)
    return NextResponse.json({ status: "parse_error" }, { status: 200 })
  }

  // Process each message
  for (const msg of messages) {
    console.log("[WhatsApp POST] Processing message:", {
      from:      msg.from,
      type:      msg.type,
      text:      msg.text,
      messageId: msg.messageId,
      timestamp: msg.timestamp,
    })

    await markMessageAsRead(msg.messageId).catch(err =>
      console.warn("[WhatsApp POST] markAsRead failed:", err.message)
    )

    await handleIncomingMessage(msg).catch(err =>
      console.error("[WhatsApp POST] handleIncomingMessage failed:", err.message, err.stack)
    )
  }

  console.log("[WhatsApp POST] ✅ Done — returning 200")
  // CRITICAL: always 200 — Meta retries on any other status
  return NextResponse.json({ status: "ok" }, { status: 200 })
}
