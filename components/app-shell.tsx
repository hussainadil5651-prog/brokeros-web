'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import GlobalSearch from '@/components/global-search'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  if (isLogin) return <>{children}</>
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pl-48">
        <div className="fixed right-4 top-3 z-30">
          <GlobalSearch />
        </div>
        {children}
      </div>
    </div>
  )
}
