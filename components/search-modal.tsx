'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult { type: string; label: string; subtitle: string; href: string; icon: string }

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase(); const all: SearchResult[] = []
      try { const r = await fetch('/api/loads'); if (r.ok) { const d = await r.json(); for (const l of (d.loads ?? [])) { if ((l.loadNumber||'').toLowerCase().includes(q)||(l.customerName||'').toLowerCase().includes(q)) all.push({ type: 'Load', label: l.loadNumber, subtitle: l.customerName, href: `/loads/${l.id}`, icon: 'L' }) } } } catch {}
      try { const r = await fetch('/api/broker?type=prospects'); if (r.ok) { const d = await r.json(); for (const p of (d.prospects ?? [])) { if ((p.email||'').toLowerCase().includes(q)||(p.companyName||'').toLowerCase().includes(q)) all.push({ type: 'Prospect', label: p.email, subtitle: p.companyName||'', href: '/prospects', icon: 'P' }) } } } catch {}
      try { const r = await fetch('/api/broker?type=customers'); if (r.ok) { const d = await r.json(); for (const c of (d.customers ?? [])) { if ((c.email||'').toLowerCase().includes(q)||(c.companyName||'').toLowerCase().includes(q)) all.push({ type: 'Customer', label: c.email, subtitle: c.companyName||'', href: '/customers', icon: 'C' }) } } } catch {}
      setResults(all.slice(0, 20)); setLoading(false)
    }, 300); return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open])

  const handleSelect = useCallback((href: string) => { onClose(); router.push(href) }, [router, onClose])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx].href)
    if (e.key === 'Escape') onClose()
  }, [results, selectedIdx, handleSelect, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-[#e8e6e1] bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center border-b border-[#e8e6e1] px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-[#9a9589]"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }} onKeyDown={handleKeyDown} placeholder="Search loads, prospects, customers..." className="w-full bg-transparent px-3 py-4 text-sm text-[#1a1917] placeholder-[#9a9589] outline-none" />
          <kbd className="flex-shrink-0 rounded border border-[#e8e6e1] px-2 py-0.5 text-[10px] text-[#9a9589]">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[#9a9589]"><div className="spinner" />Searching...</div>}
          {!loading && query && results.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#9a9589]">No results for <span className="font-mono text-[#6b6960]">{query}</span></div>}
          {!loading && results.map((r, i) => (
            <button key={`${r.type}-${i}`} onClick={() => handleSelect(r.href)} onMouseEnter={() => setSelectedIdx(i)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-all ${i === selectedIdx ? 'bg-amber-50' : 'hover:bg-[#f3f2ee]'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ${r.type === 'Load' ? 'bg-amber-100 text-amber-700' : r.type === 'Prospect' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.icon}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#1a1917]">{r.label}</p><p className="truncate text-xs text-[#9a9589]">{r.subtitle}</p></div>
              <span className="text-[9px] text-[#9a9589]">{r.type}</span>
            </button>
          ))}
          {!query && <div className="px-4 py-8 text-center text-sm text-[#9a9589]">Type to search across all data</div>}
        </div>
      </div>
    </div>
  )
}
