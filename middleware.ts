/**
 * Route protection middleware — NextAuth v5 + Next.js 16
 *
 * Uses auth() as a middleware wrapper so the session is read from the JWT
 * on every request without any database query.
 *
 * ⚠ JWT limitation: role and isActive are snapshotted at login time.
 * If an admin changes a user's role or disables their account, that change
 * will not take effect until the user's current JWT expires (up to 8 hours).
 * For immediate enforcement, the user must be signed out server-side or the
 * token maxAge must be reduced. This is a known trade-off of stateless JWTs.
 *
 * Routes excluded from this middleware (see matcher below):
 *   - /api/auth/*              NextAuth's own handlers
 *   - /api/whatsapp/webhook    Public Meta webhook (GET + POST)
 *   - /api/admin/backup        Protected by BACKUP_SECRET bearer token, not session
 *   - /_next/static            Static assets
 *   - /_next/image             Image optimization
 *   - /favicon.ico             Browser favicon
 */

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Routes accessible only to ADMIN role
const ADMIN_ROUTES = [
  "/empleados",
  "/configuracion",
  "/finanzas",
  "/reportes",
  "/facturas",
  "/cobros",
  "/api/debug",           // debug endpoints — admin only
  "/api/whatsapp/diagnose",
]

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const pathname = nextUrl.pathname

  // ── 1. Authenticated user hitting /login → send to dashboard ─────────────
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // ── 2. No session → redirect to /login ───────────────────────────────────
  if (!session) {
    // Already on the login page — let it render; do NOT redirect (avoids loop)
    if (pathname === "/login") return NextResponse.next()

    // API routes without a session return 401 rather than an HTML redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL("/login", nextUrl)
    // Preserve the original destination so we can redirect back after login
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 3. Session exists but account was deactivated ────────────────────────
  // isActive is snapshotted in the JWT at login — see limitation note above.
  if (session.user.isActive === false) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // ── 4. EMPLOYEE trying to reach an ADMIN-only route → back to dashboard ──
  if (session.user.role !== "ADMIN") {
    const isAdminRoute = ADMIN_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    )
    if (isAdminRoute) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/", nextUrl))
    }
  }

  // ── 5. All checks passed — allow the request ─────────────────────────────
  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Run middleware on every path EXCEPT:
     *   _next/static       — compiled assets
     *   _next/image        — Next.js image optimization
     *   favicon.ico        — browser favicon
     *   api/auth           — NextAuth's own /api/auth/* handlers
     *   api/whatsapp/webhook — public Meta webhook (must stay unauthenticated)
     *   api/admin/backup   — cron-triggered; authenticated by BACKUP_SECRET header
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|api/whatsapp/webhook|api/admin/backup).*)",
  ],
}
