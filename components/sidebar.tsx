'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: 'followups' | 'ai'
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/outreach', label: 'Shipper Outreach', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M3 7a4 4 0 014-4h6a4 4 0 014 4v4a4 4 0 01-4 4h-1.5l-3 2v-2H7a4 4 0 01-4-4V7z" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/prospects', label: 'Prospects', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
      { href: '/customers', label: 'Customers', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M2 17c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="13" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/carriers', label: 'Carriers', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><rect x="1" y="9" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M12 10.5L15 10.5L18 14V16H12V10.5Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="5" cy="16" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="16" r="2" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/dispatch', label: 'Loads', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><rect x="3" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 14v2h6v-2" stroke="currentColor" strokeWidth="1.5"/></svg> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/invoices', label: 'Invoices', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 8h6M7 11h6M7 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { href: '/follow-ups', label: 'Follow-ups', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, badge: 'followups' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/ai', label: 'AI Co-Pilot', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5L10 2z" stroke="currentColor" strokeWidth="1.5"/></svg>, badge: 'ai' },
      { href: '/sheets', label: 'Sheets', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 7h14M7 2v16" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/settings', label: 'Settings', icon: <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.5 1.5M5.5 14.5L4 16M16 16l-1.5-1.5M5.5 5.5L4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [followUpCount, setFollowUpCount] = useState(0)
  const [aiUnread, setAiUnread] = useState(0)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  if (pathname === '/login') return null
  const name = typeof session?.user?.name === 'string' ? session.user.name.split(' ')[0] : 'Agent'

  useEffect(() => {
    fetch('/api/follow-ups/count').then(r => { if (r.ok) r.json().then(d => setFollowUpCount(d.total ?? 0)) }).catch(() => {})
    fetch('/api/ai/unread').then(r => { if (r.ok) r.json().then(d => setAiUnread(d.unread ?? 0)) }).catch(() => {})
  }, [pathname])

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[#e8e6e1] bg-white">
      {/* Logo */}
      <Link href="/dashboard" className="group flex items-center gap-3 border-b border-[#e8e6e1] px-5 py-4 transition hover:bg-[#faf9f6]">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-[#1a1917]">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <rect x="2" y="4" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 6l4 0l3 3v2h-7V6z" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="5.5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1"/>
            <circle cx="9.5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1"/>
            <circle cx="14.5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-[#1a1917]">FreightOS</p>
          <p className="text-[9px] font-medium tracking-wider text-[#9a9589] uppercase">Broker Command</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-1.5 text-[9px] font-bold tracking-widest text-[#b0ab9f] uppercase">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-amber-50 text-amber-700 shadow-sm shadow-amber-100/50'
                        : 'text-[#6b6960] hover:bg-[#faf9f6] hover:text-[#1a1917]'
                    }`}>
                    <span className={`flex-shrink-0 ${active ? 'text-amber-600' : 'text-[#9a9589]'}`}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'followups' && followUpCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{followUpCount > 9 ? '9+' : followUpCount}</span>
                    )}
                    {item.badge === 'ai' && aiUnread > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{aiUnread}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-[#e8e6e1] px-3 py-3">
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6b6960] transition hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 flex-shrink-0">
            <path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3M13 14l4-4-4-4M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="flex-1 text-left truncate">{name}</span>
          <span className="text-[10px] text-[#b0ab9f]">Logout</span>
        </button>
      </div>
    </aside>
  )
}
