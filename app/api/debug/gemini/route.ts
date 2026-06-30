/**
 * FuelOps-DR — Gemini API Diagnostic Endpoint
 *
 * GET /api/debug/gemini?secret=TOKEN
 *
 * Makes a minimal TEXT-ONLY call to Gemini ("Respond only with OK").
 * No image — zero vision tokens consumed.
 *
 * Interpretation:
 *   200 → API key is valid, text quota is fine.
 *         If Vision calls still return 429, the issue is vision-specific
 *         quota (gemini-2.0-flash has separate RPM limits per modality).
 *   429 → General quota or key issue. Check Google AI Studio for limits.
 *   403 → API key is invalid or does not have Gemini access.
 *   other → Unexpected Gemini error — full body is returned.
 */

import { NextRequest, NextResponse } from "next/server"

const SECRET = process.env.DIAGNOSTIC_SECRET ?? "fuelops-debug"
const MODEL  = "gemini-2.0-flash"

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = req.nextUrl.searchParams.get("secret")
  if (secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY ?? ""
  const maskedKey = apiKey.length >= 8
    ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
    : apiKey.length > 0 ? "****" : "(not set)"

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

  // ── Minimal text-only call ──────────────────────────────────────────────────
  const t0  = Date.now()
  let res: Response

  try {
    res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Respond only with OK" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    })
  } catch (fetchErr) {
    return NextResponse.json({
      status:      "fetch_error",
      message:     (fetchErr as Error).message,
      model:       MODEL,
      api_key:     maskedKey,
    }, { status: 500 })
  }

  const ms       = Date.now() - t0
  const rawBody  = await res.text().catch(() => "")

  // Collect all response headers
  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => { headers[key] = value })

  const rateLimitHeaders = {
    "Retry-After":                       headers["retry-after"]                       ?? null,
    "x-ratelimit-limit-requests":        headers["x-ratelimit-limit-requests"]        ?? null,
    "x-ratelimit-limit-tokens":          headers["x-ratelimit-limit-tokens"]          ?? null,
    "x-ratelimit-remaining-requests":    headers["x-ratelimit-remaining-requests"]    ?? null,
    "x-ratelimit-remaining-tokens":      headers["x-ratelimit-remaining-tokens"]      ?? null,
    "x-ratelimit-reset-requests":        headers["x-ratelimit-reset-requests"]        ?? null,
    "x-ratelimit-reset-tokens":          headers["x-ratelimit-reset-tokens"]          ?? null,
  }

  // Parse body if JSON
  let parsedBody: unknown = rawBody
  try { parsedBody = JSON.parse(rawBody) } catch { /* keep raw string */ }

  // ── Interpretation ──────────────────────────────────────────────────────────
  let interpretation: string
  if (res.status === 200) {
    interpretation =
      "✅ Text call succeeded. If Vision calls return 429, the issue is " +
      "vision-specific quota (image tokens). Check Google AI Studio → " +
      MODEL + " → Quota."
  } else if (res.status === 429) {
    interpretation =
      "❌ Even text calls are rate-limited. Problem is general quota or API key. " +
      "Check Google AI Studio → " + MODEL + " → Quota, or verify API key."
  } else if (res.status === 403) {
    interpretation =
      "❌ API key is invalid or does not have Gemini access. " +
      "Generate a new key at https://aistudio.google.com/app/apikey"
  } else {
    interpretation = `⚠️ Unexpected HTTP ${res.status} — see body for details.`
  }

  return NextResponse.json({
    http_status:     res.status,
    ms,
    model:           MODEL,
    api_key:         maskedKey,
    interpretation,
    rate_limit_headers: rateLimitHeaders,
    all_headers:     headers,
    response_body:   parsedBody,
  }, { status: 200 })
}
