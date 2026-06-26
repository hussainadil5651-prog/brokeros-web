import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'
import { AuthContext } from '@/lib/auth-context'
import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/toast'
import { GeistSans, GeistMono } from 'geist/font'

export const metadata: Metadata = {
  title: 'AFA FreightOS — Broker Command Center',
  description: 'Freight brokerage command center — real-time batching, loads, carriers, AI co-pilot, and live Google Sheets view.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f8f7f4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}
        style={{ fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"' }}>
        <AuthContext>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthContext>
      </body>
    </html>
  )
}
