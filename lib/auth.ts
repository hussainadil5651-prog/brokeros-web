import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { findUserByEmail, verifyPassword, findOrCreateUser } from '@/lib/google-sheets'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const key = `login:${credentials.email.toLowerCase()}`
        const { allowed, retryAfterMs } = checkRateLimit(key)
        if (!allowed) {
          console.warn(`Rate limited login for ${credentials.email} — retry after ${Math.ceil(retryAfterMs / 1000)}s`)
          return null
        }
        const user = await findUserByEmail(credentials.email)
        if (!user) {
          if (credentials.password.length >= 6) {
            const newUser = await findOrCreateUser(credentials.email, credentials.password)
            if (newUser) { resetRateLimit(key); return { id: newUser.user_id, email: newUser.email, name: newUser.name, role: newUser.role } }
          }
          return null
        }
        const valid = await verifyPassword(credentials.email, credentials.password)
        if (!valid) return null
        resetRateLimit(key)
        return { id: user.user_id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase()
        if (!email) return false
        // Auto-create user for any Google sign-in
        const existing = await findUserByEmail(email)
        if (existing) {
          user.name = existing.name
          user.role = existing.role
        } else {
          // New Google user — create account
          const newUser = await findOrCreateUser(email, '')
          if (newUser) { user.name = newUser.name; user.role = newUser.role }
        }
        return true
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id ?? user.email }
      return token
    },
    async session({ session, token }) {
      if (session.user) { session.user.role = token.role ?? ''; session.user.id = token.id ?? '' }
      return session
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
