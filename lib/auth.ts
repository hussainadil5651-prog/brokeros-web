import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { findUserByEmail, verifyPassword } from '@/lib/google-sheets'

const ALLOWED_EMAILS = ['adil@afadispatch.com', 'adilhussainwork2@gmail.com', 'addass@afadispatch.com', 'faiq@afadispatch.com']

const USER_MAP: Record<string, { name: string; role: string }> = {
  'adil@afadispatch.com': { name: 'Adil', role: 'admin' },
  'adilhussainwork2@gmail.com': { name: 'Adil', role: 'admin' },
  'addass@afadispatch.com': { name: 'Addass', role: 'agent' },
  'faiq@afadispatch.com': { name: 'Faiq', role: 'agent' },
}

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
        email: { label: 'Email', type: 'email', placeholder: 'adil@afadispatch.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await findUserByEmail(credentials.email)
        if (!user) return null

        const valid = await verifyPassword(credentials.email, credentials.password)
        if (!valid) return null

        return {
          id: user.user_id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase()
        if (!email || !ALLOWED_EMAILS.includes(email)) return false
        const info = USER_MAP[email]
        user.name = info.name
        user.role = info.role
        return true
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id ?? user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? ''
        session.user.id = token.id ?? ''
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'afa-dispatch-dev-secret-change-in-prod',
}
