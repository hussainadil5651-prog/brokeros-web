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
      { href: '/dashboard', label: 'Dashboard', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/outreach', label: 'Shipper Outreach', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M3 7a4 4 0 014-4h6a4 4 0 014 4v4a4 4 0 01-4 4h-1.5l-3 2v-2H7a4 4 0 01-4-4V7z" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/prospects', label: 'Prospects', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
      { href: '/customers', label: 'Customers', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M2 17c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="13" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/carriers', label: 'Carriers', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="1" y="9" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M12 10.5L15 10.5L18 14V16H12V10.5Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="5" cy="16" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="16" r="2" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/dispatch', label: 'Loads', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="3" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 14v2h6v-2" stroke="currentColor" strokeWidth="1.5"/></svg> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/invoices', label: 'Invoices', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 8h6M7 11h6M7 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { href: '/follow-ups', label: 'Follow-ups', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, badge: 'followups' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/ai', label: 'AI Co-Pilot', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5L10 2z" stroke="currentColor" strokeWidth="1.5"/></svg>, badge: 'ai' },
      { href: '/sheets', label: 'Sheets', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 7h14M7 2v16" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { href: '/settings', label: 'Settings', icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.5 1.5M5.5 14.5L4 16M16 16l-1.5-1.5M5.5 5.5L4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-48 flex-col border-r border-white/[0.06] bg-zinc-950/95 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/dashboard" className="group flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5 transition hover:bg-white/[0.02]">
        <div className="flex-shrink-0 perspective-500">
          <svg viewBox="0 0 48 48" className="h-6 w-6 transition-transform duration-500 group-hover:rotate-y-12 group-hover:scale-110" style={{ transformStyle: 'preserve-3d' }}>
            <defs>
              <linearGradient id="cabG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id="trailerG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1c1917" />
                <stop offset="100%" stopColor="#292524" />
              </linearGradient>
            </defs>
            <ellipse cx="24" cy="42" rx="20" ry="2" fill="rgba(0,0,0,0.3)" />
            <rect x="6" y="12" width="26" height="18" rx="2" fill="url(#trailerG)" stroke="#44403c" strokeWidth="0.8" />
            <line x1="10" y1="18" x2="28" y2="18" stroke="#44403c" strokeWidth="0.5" />
            <line x1="10" y1="22" x2="28" y2="22" stroke="#44403c" strokeWidth="0.5" />
            <line x1="10" y1="26" x2="28" y2="26" stroke="#44403c" strokeWidth="0.5" />
            <path d="M32 14 L32 28 L44 28 L44 20 L40 14 Z" fill="url(#cabG)" stroke="#d97706" strokeWidth="0.8" />
            <rect x="40" y="16" width="3" height="6" rx="0.5" fill="#0c0a09" opacity="0.7" />
            <circle cx="14" cy="30" r="3.5" fill="#292524" stroke="#1c1917" strokeWidth="0.8" />
            <circle cx="14" cy="30" r="1.5" fill="#44403c" />
            <circle cx="26" cy="30" r="3.5" fill="#292524" stroke="#1c1917" strokeWidth="0.8" />
            <circle cx="26" cy="30" r="1.5" fill="#44403c" />
            <circle cx="38" cy="30" r="3.5" fill="#292524" stroke="#1c1917" strokeWidth="0.8" />
            <circle cx="38" cy="30" r="1.5" fill="#44403c" />
            <rect x="33" y="15" width="4" height="2" rx="1" fill="#fbbf24" opacity="0.4" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold tracking-tight text-amber-400">AFA FreightOS</p>
          <p className="text-[7px] font-mono text-zinc-700 tracking-widest uppercase">Broker Command</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-1.5 py-2 space-y-3">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-0.5 text-[8px] font-semibold tracking-widest text-zinc-700 uppercase">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition press ${
                      active
                        ? 'bg-amber-500/10 text-amber-400 before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-0.5 before:rounded-full before:bg-amber-500'
                        : 'text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400'
                    }`}>
                    <span className={`flex-shrink-0 transition ${active ? 'text-amber-400' : 'text-zinc-600'}`}>{item.icon}</span>
                    <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                    {item.badge === 'followups' && followUpCount > 0 && (
                      <span className="ml-auto flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[7px] font-bold text-white">{followUpCount > 9 ? '9+' : followUpCount}</span>
                    )}
                    {item.badge === 'ai' && aiUnread > 0 && (
                      <span className="ml-auto flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[7px] font-bold text-zinc-950">{aiUnread}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-white/[0.06] px-1.5 py-2">
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400 press">
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 flex-shrink-0">
            <path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3M13 14l4-4-4-4M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="flex-1 text-left text-[10px] font-medium tracking-wide truncate">{name}</span>
          <span className="text-[8px] text-zinc-700 font-mono">Logout</span>
        </button>
      </div>
    </aside>
  )
}
