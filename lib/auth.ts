import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

const SESSION_SHORT =  8 * 60 * 60        //  8 hours (normal session)
const SESSION_LONG  = 30 * 24 * 60 * 60   // 30 days  (remember me)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email:      { label: "Correo electrónico", type: "email"    },
        password:   { label: "Contraseña",         type: "password" },
        rememberMe: { label: "Mantener sesión",    type: "text"     },
      },
      async authorize(credentials) {
        const email      = credentials?.email      as string | undefined
        const password   = credentials?.password   as string | undefined
        const rememberMe = credentials?.rememberMe === "true"

        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })

        // Reject unknown users, users without a password, and inactive accounts
        if (!user || !user.passwordHash || !user.isActive) return null

        const passwordValid = await compare(password, user.passwordHash)
        if (!passwordValid) return null

        // Record login timestamp — non-fatal if it fails
        try {
          await prisma.user.update({
            where: { id: user.id },
            data:  { lastLoginAt: new Date() },
          })
        } catch {
          console.error("[auth] Failed to update lastLoginAt for user", user.id)
        }

        return {
          id:         user.id,
          email:      user.email    ?? "",
          name:       user.name     ?? "",
          role:       user.role,
          isActive:   user.isActive,
          rememberMe,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Cookie lifetime is always 30 days so persistent sessions work.
    // The JWT's own exp claim (set in the jwt callback below) is what
    // actually enforces the 8-hour vs 30-day distinction.
    maxAge: SESSION_LONG,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Snapshot auth fields at login time — see middleware.ts for JWT limitation note
        token.role       = (user as { role?: string }).role
        token.isActive   = (user as { isActive?: boolean }).isActive
        token.rememberMe = (user as { rememberMe?: boolean }).rememberMe ?? false

        // Override the token expiry based on the user's choice.
        // NextAuth reads token.exp to decide if the JWT is still valid.
        const maxAge = token.rememberMe ? SESSION_LONG : SESSION_SHORT
        token.exp    = Math.floor(Date.now() / 1000) + maxAge
      }
      return token
    },
    session({ session, token }) {
      if (token.sub)              session.user.id         = token.sub
      if (token.role)             session.user.role       = token.role       as string
      if (token.isActive != null) session.user.isActive   = token.isActive   as boolean
      return session
    },
  },
})
