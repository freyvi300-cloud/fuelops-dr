/**
 * FuelOps-DR — Gemini Model Discovery Endpoint
 *
 * GET /api/debug/models?secret=TOKEN
 *
 * Queries the Gemini v1beta models list and returns:
 *   - all available models
 *   - which ones support generateContent (needed for OCR)
 *   - which ones support vision (image input)
 *   - a recommended model for image understanding
 *
 * Use this to find the correct model name before updating gemini.ts.
 */

import { NextRequest, NextResponse } from "next/server"

const SECRET = process.env.DIAGNOSTIC_SECRET ?? "fuelops-debug"

interface GeminiModel {
  name:                   string
  displayName?:           string
  description?:           string
  version?:               string
  supportedGenerationMethods?: string[]
  inputTokenLimit?:       number
  outputTokenLimit?:      number
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  if (secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY ?? ""
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })
  }

  const maskedKey = apiKey.length >= 8
    ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
    : "****"

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`

  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  const rawBody = await res.text()
  let data: { models?: GeminiModel[]; error?: unknown } = {}
  try { data = JSON.parse(rawBody) } catch { /* keep empty */ }

  if (!res.ok) {
    return NextResponse.json({
      http_status: res.status,
      api_key:     maskedKey,
      error:       data.error ?? rawBody,
    }, { status: 200 })
  }

  const allModels = data.models ?? []

  // ── Filter: models that support generateContent ───────────────────────────
  const generateModels = allModels.filter(m =>
    m.supportedGenerationMethods?.includes("generateContent")
  )

  // ── Highlight likely vision-capable models (flash/pro variants) ────────────
  // Vision models typically have "flash" or "pro" in the name and support
  // generateContent. We sort by name descending to surface newer versions first.
  const visionCandidates = generateModels
    .filter(m => /flash|pro/i.test(m.name))
    .sort((a, b) => b.name.localeCompare(a.name))

  // Pick the recommended model: prefer "flash" for speed/cost, newest version
  const recommended = visionCandidates[0] ?? generateModels[0] ?? null

  return NextResponse.json({
    api_key:     maskedKey,
    total_models: allModels.length,
    generate_content_models: generateModels.length,

    // ── Main output: all models that support generateContent ────────────────
    models_for_generate_content: generateModels.map(m => ({
      name:         m.name,
      displayName:  m.displayName,
      description:  m.description?.slice(0, 120),
      inputTokenLimit:  m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
    })),

    // ── Vision candidates (flash/pro that support generateContent) ──────────
    vision_candidates: visionCandidates.map(m => m.name),

    // ── Recommendation ──────────────────────────────────────────────────────
    recommended_for_vision: recommended
      ? {
          name:        recommended.name,
          displayName: recommended.displayName,
          description: recommended.description?.slice(0, 200),
        }
      : null,

    instruction:
      "Share this output. The 'recommended_for_vision.name' field will be used " +
      "to replace all references to the old model in the codebase.",
  }, { status: 200 })
}
