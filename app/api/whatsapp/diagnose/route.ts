/**
 * FuelOps-DR — WhatsApp Self-Diagnostic + Auto-Fix Endpoint
 *
 * Usage (one-time, from browser or curl):
 *   GET https://your-app.vercel.app/api/whatsapp/diagnose?secret=fuelops-nova-webhook-2025
 *
 * What it does:
 *   1. Verifies all env vars are configured
 *   2. Calls GET /{WABA_ID}/subscribed_apps — checks WABA subscription
 *   3. If not subscribed → calls POST /{WABA_ID}/subscribed_apps (auto-fix)
 *   4. Checks phone number details
 *   5. Returns a full JSON report with every step
 *
 * Delete or protect this file after the issue is resolved.
 */

import { NextRequest, NextResponse } from "next/server"

const WABA_ID    = "2139335246632222"
const API_BASE   = "https://graph.facebook.com/v20.0"

export async function GET(req: NextRequest) {
  // Gate: require the verify token as query param to avoid public exposure
  const secret = req.nextUrl.searchParams.get("secret")
  const expectedSecret = process.env.WHATSAPP_VERIFY_TOKEN ?? "fuelops-nova-webhook-2025"
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden — add ?secret=YOUR_VERIFY_TOKEN" }, { status: 403 })
  }

  const token       = process.env.WHATSAPP_ACCESS_TOKEN    ?? ""
  const phoneId     = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ""
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN    ?? ""

  const report: Record<string, unknown> = {
    timestamp:  new Date().toISOString(),
    waba_id:    WABA_ID,
    env_vars: {
      WHATSAPP_VERIFY_TOKEN:    verifyToken   ? `SET (${verifyToken.length} chars: "${verifyToken}")` : "❌ MISSING",
      WHATSAPP_ACCESS_TOKEN:    token         ? `SET (${token.length} chars, starts: ${token.slice(0, 10)}…)` : "❌ MISSING",
      WHATSAPP_PHONE_NUMBER_ID: phoneId       ? `SET: "${phoneId}"` : "❌ MISSING",
    },
  }

  if (!token) {
    report.error = "WHATSAPP_ACCESS_TOKEN is empty — cannot call Meta API. Set it in Vercel env vars."
    return NextResponse.json(report, { status: 200 })
  }

  // ── Step 1: Check WABA subscribed apps ─────────────────────────────────────
  let subscribed = false
  let appId: string | null = null

  try {
    const res  = await fetch(`${API_BASE}/${WABA_ID}/subscribed_apps?access_token=${token}`)
    const data = await res.json() as { data?: Array<{ whatsapp_business_api_data?: { id: string; name: string } }> }

    report.step1_check_waba_subscription = {
      http_status:  res.status,
      raw_response: data,
    }

    if (!res.ok) {
      report.step1_check_waba_subscription = {
        ...report.step1_check_waba_subscription as object,
        error: "Meta API returned non-200 — token might be expired or invalid",
      }
    } else {
      const apps = data.data ?? []
      subscribed = apps.length > 0
      appId      = apps[0]?.whatsapp_business_api_data?.id ?? null
      report.step1_check_waba_subscription = {
        ...report.step1_check_waba_subscription as object,
        subscribed,
        subscribed_app_id:   appId,
        subscribed_app_name: apps[0]?.whatsapp_business_api_data?.name ?? null,
        verdict: subscribed
          ? "✅ App already subscribed to WABA"
          : "❌ App NOT subscribed to WABA — this is why POSTs are not arriving",
      }
    }
  } catch (err) {
    report.step1_check_waba_subscription = { error: String(err) }
  }

  // ── Step 2: Auto-subscribe if needed ────────────────────────────────────────
  if (!subscribed) {
    try {
      const res  = await fetch(`${API_BASE}/${WABA_ID}/subscribed_apps`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: ["messages", "message_deliveries", "message_reads", "message_echoes"],
        }),
      })
      const data = await res.json() as { success?: boolean; error?: unknown }

      report.step2_auto_subscribe = {
        http_status:  res.status,
        raw_response: data,
        verdict: data.success === true
          ? "✅ Successfully subscribed app to WABA — messages should now flow"
          : `❌ Subscription failed: ${JSON.stringify(data.error ?? data)}`,
      }
    } catch (err) {
      report.step2_auto_subscribe = { error: String(err) }
    }
  } else {
    report.step2_auto_subscribe = { skipped: "App was already subscribed, no action needed" }
  }

  // ── Step 3: Verify subscription after fix ───────────────────────────────────
  try {
    const res  = await fetch(`${API_BASE}/${WABA_ID}/subscribed_apps?access_token=${token}`)
    const data = await res.json() as { data?: Array<{ whatsapp_business_api_data?: { id: string; name: string } }> }
    const apps = data.data ?? []
    report.step3_verify_after_fix = {
      now_subscribed:      apps.length > 0,
      subscribed_app_id:   apps[0]?.whatsapp_business_api_data?.id ?? null,
      subscribed_app_name: apps[0]?.whatsapp_business_api_data?.name ?? null,
      verdict: apps.length > 0
        ? "✅ WABA subscription confirmed — send a WhatsApp message to test"
        : "❌ Still not subscribed — check token permissions (needs whatsapp_business_management scope)",
    }
  } catch (err) {
    report.step3_verify_after_fix = { error: String(err) }
  }

  // ── Step 4: Check phone number details ──────────────────────────────────────
  if (phoneId) {
    try {
      const res  = await fetch(`${API_BASE}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,platform_type,status&access_token=${token}`)
      const data = await res.json()
      report.step4_phone_number_details = { http_status: res.status, data }
    } catch (err) {
      report.step4_phone_number_details = { error: String(err) }
    }
  } else {
    report.step4_phone_number_details = { skipped: "WHATSAPP_PHONE_NUMBER_ID not set" }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const sub3 = report.step3_verify_after_fix as Record<string,unknown>
  report.summary = {
    was_subscribed_before: subscribed,
    auto_fix_applied:      !subscribed,
    is_subscribed_now:     sub3?.now_subscribed === true,
    next_step: sub3?.now_subscribed === true
      ? "Send 'hola' from your WhatsApp to the Business number — Vercel should now receive the POST"
      : "Check that WHATSAPP_ACCESS_TOKEN has 'whatsapp_business_management' permission",
  }

  return NextResponse.json(report, { status: 200 })
}
