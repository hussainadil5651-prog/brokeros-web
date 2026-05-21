'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResult {
  type: string
  label: string
  subtitle: string
  href: string
  icon: string
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return }
    if (query.length < 2) { setResults([]); return }

    const timer = setTimeout(async () => {
      setSearching(true)
      const q = query.toLowerCase()
      const all: SearchResult[] = []

      try {
        const loadR = await fetch('/api/loads')
        if (loadR.ok) {
          const d = await loadR.json()
          for (const l of (d.loads ?? [])) {
            if ((l.loadNumber || '').toLowerCase().includes(q) ||
                (l.customerName || '').toLowerCase().includes(q) ||
                (l.carrierName || '').toLowerCase().includes(q) ||
                (l.pickUpLocation || '').toLowerCase().includes(q) ||
                (l.deliveryLocation || '').toLowerCase().includes(q)) {
              all.push({ type: 'Load', label: l.loadNumber, subtitle: `${l.customerName} · ${l.pickUpLocation} → ${l.deliveryLocation}`, href: `/loads/${l.id}`, icon: 'L' })
            }
          }
        }
      } catch {}

      try {
        const pR = await fetch('/api/broker?type=prospects')
        if (pR.ok) {
          const d = await pR.json()
          for (const p of (d.prospects ?? [])) {
            if ((p.email || '').toLowerCase().includes(q) ||
                (p.companyName || '').toLowerCase().includes(q) ||
                (p.contactName || '').toLowerCase().includes(q)) {
              all.push({ type: 'Prospect', label: p.email, subtitle: `${p.companyName || ''} · ${p.contactName || ''}`, href: '/prospects', icon: 'P' })
            }
          }
        }
      } catch {}

      try {
        const cR = await fetch('/api/broker?type=customers')
        if (cR.ok) {
          const d = await cR.json()
          for (const c of (d.customers ?? [])) {
            if ((c.email || '').toLowerCase().includes(q) ||
                (c.companyName || '').toLowerCase().includes(q) ||
                (c.contactName || '').toLowerCase().includes(q)) {
              all.push({ type: 'Customer', label: c.email, subtitle: `${c.companyName || ''} · ${c.contactName || ''}`, href: '/customers', icon: 'C' })
            }
          }
        }
      } catch {}

      try {
        const carR = await fetch('/api/broker?type=carriers')
        if (carR.ok) {
          const d = await carR.json()
          for (const c of (d.carriers ?? [])) {
            if ((c.carrierName || '').toLowerCase().includes(q) ||
                (c.mcNumber || '').toLowerCase().includes(q) ||
                (c.lane || '').toLowerCase().includes(q) ||
                (c.customerName || '').toLowerCase().includes(q)) {
              all.push({ type: 'Carrier', label: c.carrierName, subtitle: `${c.mcNumber || ''} · ${c.lane || ''}`, href: '/carriers', icon: 'T' })
            }
          }
        }
      } catch {}

      try {
        const fuR = await fetch('/api/follow-ups')
        if (fuR.ok) {
          const d = await fuR.json()
          for (const f of (d.followUps ?? [])) {
            if ((f.email || '').toLowerCase().includes(q)) {
              all.push({ type: 'Follow-up', label: f.email, subtitle: f.notes || '', href: '/follow-ups', icon: 'F' })
            }
          }
        }
      } catch {}

      all.sort((a, b) => a.type.localeCompare(b.type))
      setResults(all.slice(0, 30))
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, open])

  function handleSelect(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 py-1.5 text-xs text-zinc-600 transition hover:bg-white/[0.03] hover:text-zinc-400 press">
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[10px] hidden sm:inline">Search</span>
        <span className="ml-1 rounded border border-white/[0.06] px-1 text-[8px] text-zinc-700 font-mono hidden sm:inline">Ctrl+K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative w-full max-w-xl rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl overlay overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b border-white/[0.06] px-4">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 flex-shrink-0 text-zinc-600">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search loads, prospects, customers, carriers, emails..."
                className="flex-1 bg-transparent px-3 py-3.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none" />
              {searching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />}
              <button onClick={() => setOpen(false)} className="ml-2 rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-zinc-700 font-mono">ESC</button>
            </div>

            {results.length > 0 && (
              <div className="max-h-80 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
                {results.map((r, i) => (
                  <button key={`${r.type}-${r.label}-${i}`} onClick={() => handleSelect(r.href)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-800/80 press">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ${
                      r.type === 'Load' ? 'bg-amber-500/15 text-amber-400' :
                      r.type === 'Prospect' ? 'bg-blue-500/15 text-blue-400' :
                      r.type === 'Customer' ? 'bg-emerald-500/15 text-emerald-400' :
                      r.type === 'Carrier' ? 'bg-violet-500/15 text-violet-400' :
                      'bg-rose-500/15 text-rose-400'
                    }`}>{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200 truncate">{r.label}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-[9px] text-zinc-700">{r.type}</span>
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !searching && (
              <div className="py-12 text-center">
                <p className="text-sm text-zinc-700">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-zinc-700 mt-1">Try a different search term</p>
              </div>
            )}

            {query.length < 2 && (
              <div className="py-8 text-center">
                <p className="text-xs text-zinc-700">Type at least 2 characters to search across all data</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
