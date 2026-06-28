/**
 * FuelOps-DR — WhatsApp Self-Diagnostic + Auto-Fix
 *
 * GET /api/whatsapp/diagnose?secret=TOKEN
 *   → full diagnostic (check subscription, phone details)
 *
 * GET /api/whatsapp/diagnose?secret=TOKEN&action=subscribe&target_app=APP_ID
 *   → force subscription + confirm APP_ID appears in subscribed list
 */

import { NextRequest, NextResponse } from "next/server"

const WABA_ID  = "2139335246632222"
const BASE     = "https://graph.facebook.com/v20.0"

export async function GET(req: NextRequest) {
  const secret      = req.nextUrl.searchParams.get("secret")
  const action      = req.nextUrl.searchParams.get("action")   // "subscribe" to force
  const targetAppId = req.nextUrl.searchParams.get("target_app") ?? ""

  const expectedSecret = process.env.WHATSAPP_VERIFY_TOKEN ?? "fuelops-nova-webhook-2025"
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden — add ?secret=YOUR_VERIFY_TOKEN" }, { status: 403 })
  }

  const token   = process.env.WHATSAPP_ACCESS_TOKEN    ?? ""
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ""
  const verTok  = process.env.WHATSAPP_VERIFY_TOKEN    ?? ""

  const report: Record<string, unknown> = {
    timestamp:   new Date().toISOString(),
    waba_id:     WABA_ID,
    target_app:  targetAppId || "(not specified)",
    env_vars: {
      WHATSAPP_VERIFY_TOKEN:    verTok  ? `SET ("${verTok}")` : "❌ MISSING",
      WHATSAPP_ACCESS_TOKEN:    token   ? `SET (${token.length} chars, starts: ${token.slice(0,15)}…)` : "❌ MISSING",
      WHATSAPP_PHONE_NUMBER_ID: phoneId ? `SET: "${phoneId}"` : "❌ MISSING",
    },
  }

  if (!token) {
    report.error = "WHATSAPP_ACCESS_TOKEN is empty"
    return NextResponse.json(report, { status: 200 })
  }

  // ── Step 0: Identify which app owns this token ──────────────────────────────
  try {
    const r = await fetch(`${BASE}/me?fields=id,name,type`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const d = await r.json() as Record<string, unknown>
    report.step0_token_owner = {
      http_status: r.status,
      data:        d,
      verdict: r.ok
        ? `Token belongs to: id=${d.id}, name=${d.name}, type=${d.type}`
        : `Token introspection failed: ${JSON.stringify(d)}`,
      matches_target: targetAppId ? (String(d.id) === targetAppId ? "✅ YES" : `❌ NO — token id=${d.id}, target=${targetAppId}`) : "n/a",
    }
  } catch (e) {
    report.step0_token_owner = { error: String(e) }
  }

  // ── Step 1: Current subscriptions ──────────────────────────────────────────
  let subscribedIds: string[] = []
  try {
    const r = await fetch(`${BASE}/${WABA_ID}/subscribed_apps`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const d = await r.json() as { data?: Array<{ whatsapp_business_api_data?: { id: string; name: string } }> }
    subscribedIds = (d.data ?? []).map(a => a.whatsapp_business_api_data?.id ?? "")
    report.step1_current_subscriptions = {
      http_status:    r.status,
      raw_response:   d,
      subscribed_ids: subscribedIds,
      target_present: targetAppId ? subscribedIds.includes(targetAppId) : "n/a",
      verdict: r.ok
        ? (subscribedIds.length === 0
            ? "❌ No apps subscribed to WABA"
            : `Apps subscribed: ${subscribedIds.join(", ")}`)
        : `API error: ${JSON.stringify(d)}`,
    }
  } catch (e) {
    report.step1_current_subscriptions = { error: String(e) }
  }

  // ── Step 2: Force subscription (always run when action=subscribe) ──────────
  if (action === "subscribe" || !subscribedIds.includes(targetAppId)) {
    try {
      const r = await fetch(`${BASE}/${WABA_ID}/subscribed_apps`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: ["messages", "message_deliveries", "message_reads", "message_echoes"],
        }),
      })
      const d = await r.json() as Record<string, unknown>
      report.step2_subscribe = {
        http_status:  r.status,
        raw_response: d,
        verdict: d.success === true
          ? "✅ POST /subscribed_apps succeeded"
          : `❌ Failed: ${JSON.stringify(d)}`,
      }
    } catch (e) {
      report.step2_subscribe = { error: String(e) }
    }
  } else {
    report.step2_subscribe = { skipped: `Target app ${targetAppId} already in subscription list` }
  }

  // ── Step 3: Re-read subscriptions to confirm ────────────────────────────────
  try {
    const r = await fetch(`${BASE}/${WABA_ID}/subscribed_apps`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const d = await r.json() as { data?: Array<{ whatsapp_business_api_data?: { id: string; name: string } }> }
    const ids = (d.data ?? []).map(a => a.whatsapp_business_api_data?.id ?? "")
    const targetFound = targetAppId ? ids.includes(targetAppId) : null
    report.step3_confirm = {
      http_status:    r.status,
      subscribed_ids: ids,
      subscribed_names: (d.data ?? []).map(a => a.whatsapp_business_api_data?.name ?? ""),
      raw_response:   d,
      target_present: targetFound,
      verdict: targetFound === true
        ? `✅ App ${targetAppId} IS in subscribed list — webhook should now receive POSTs`
        : targetFound === false
          ? `❌ App ${targetAppId} NOT in subscribed list — token may belong to a different app`
          : `(specify ?target_app=APP_ID to verify)`,
    }
  } catch (e) {
    report.step3_confirm = { error: String(e) }
  }

  // ── Step 4: Phone number details ────────────────────────────────────────────
  if (phoneId) {
    try {
      const r = await fetch(
        `${BASE}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,platform_type,status,name_status`,
        { headers: { "Authorization": `Bearer ${token}` } },
      )
      const d = await r.json()
      report.step4_phone_details = { http_status: r.status, data: d }
    } catch (e) {
      report.step4_phone_details = { error: String(e) }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const s3 = report.step3_confirm as Record<string,unknown>
  const s0 = report.step0_token_owner as Record<string,unknown>
  report.summary = {
    token_owner_id:    (s0?.data as Record<string,unknown>)?.id,
    target_app_id:     targetAppId || "(none provided)",
    token_matches_target: targetAppId
      ? String((s0?.data as Record<string,unknown>)?.id) === targetAppId
      : "unknown",
    target_subscribed: s3?.target_present,
    conclusion: s3?.target_present === true
      ? "✅ READY — your app is subscribed, messages should trigger POST"
      : s3?.target_present === false && targetAppId
        ? "❌ Token does not belong to your target app — generate a token FROM app " + targetAppId
        : "Specify ?target_app=YOUR_APP_ID to verify",
  }

  return NextResponse.json(report, { status: 200 })
}
