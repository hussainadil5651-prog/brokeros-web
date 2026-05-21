'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  type: 'load' | 'carrier' | 'invoice' | 'email' | 'lead'
  label: string
  subtitle: string
  href: string
  badge?: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  load: { label: 'Load', color: 'text-amber-400' },
  carrier: { label: 'Carrier', color: 'text-cyan-400' },
  invoice: { label: 'Invoice', color: 'text-purple-400' },
  email: { label: 'Email', color: 'text-emerald-400' },
  lead: { label: 'Lead', color: 'text-amber-300' },
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/emails/search?q=${encodeURIComponent(query)}&scope=global`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results ?? [])
        }
      } catch { /* silent */ } finally { setLoading(false) }
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open])

  const handleSelect = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [router, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) { handleSelect(results[selectedIdx].href) }
    if (e.key === 'Escape') { onClose() }
  }, [results, selectedIdx, handleSelect, onClose])

  if (!open) return null

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-lg border border-white/[0.06] bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-white/[0.06] px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-zinc-500">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search loads, carriers, invoices, emails..."
            className="w-full bg-transparent px-3 py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none"
          />
          <kbd className="flex-shrink-0 rounded border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-zinc-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-600">
              No results for <span className="font-mono text-zinc-400">{query}</span>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className={`text-[10px] font-semibold tracking-widest uppercase ${TYPE_CONFIG[type]?.color ?? 'text-zinc-500'}`}>
                  {TYPE_CONFIG[type]?.label ?? type}
                </span>
                <span className="text-[10px] text-zinc-700">{items.length}</span>
              </div>
              {items.map((item, i) => {
                const globalIdx = results.indexOf(item)
                return (
                  <button
                    key={`${item.type}-${item.href}-${i}`}
                    onClick={() => handleSelect(item.href)}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      globalIdx === selectedIdx ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className={`flex-shrink-0 text-[10px] font-medium uppercase ${TYPE_CONFIG[type]?.color ?? 'text-zinc-500'}`}>
                      {type === 'load' ? '◈' : type === 'carrier' ? '⛋' : type === 'invoice' ? '⊟' : type === 'email' ? '✉' : '⚡'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{item.label}</p>
                      <p className="truncate text-xs text-zinc-600">{item.subtitle}</p>
                    </div>
                    {item.badge && (
                      <span className="flex-shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        {item.badge.replace('_', ' ')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {!query && (
            <div className="px-4 py-8 text-center text-sm text-zinc-700">
              Type to search across loads, carriers, invoices, and emails
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2 text-[10px] text-zinc-700">
          <span><kbd className="rounded border border-white/[0.06] px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border border-white/[0.06] px-1">↵</kbd> Open</span>
          <span><kbd className="rounded border border-white/[0.06] px-1">⌘K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  )
}
