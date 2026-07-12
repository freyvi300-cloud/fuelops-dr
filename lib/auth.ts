import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Correo electrónico", type: "email"    },
        password: { label: "Contraseña",         type: "password" },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })

        // Reject unknown users, users without a password, and inactive accounts
        if (!user || !user.passwordHash || !user.isActive) return null

        const passwordValid = await compare(password, user.passwordHash)
        if (!passwordValid) return null

        // Record the login timestamp. Failure is non-fatal — valid credentials
        // should never be blocked by a timestamp write error.
        try {
          await prisma.user.update({
            where: { id: user.id },
            data:  { lastLoginAt: new Date() },
          })
        } catch {
          // Log to server console only; never expose DB errors to the client
          console.error("[auth] Failed to update lastLoginAt for user", user.id)
        }

        return {
          id:    user.id,
          email: user.email ?? "",
          name:  user.name  ?? "",
          role:  user.role,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge:   8 * 60 * 60, // 8 hours — re-login required each working day
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Persist role and id from the authorize() return value into the JWT
        token.role = (user as { role?: string }).role
        token.id   = user.id
      }
      return token
    },
    session({ session, token }) {
      if (token.sub)  session.user.id   = token.sub
      if (token.role) session.user.role = token.role as string
      return session
    },
  },
})
