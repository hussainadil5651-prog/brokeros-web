'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Prospect { email: string; companyName: string; contactName: string; phone: string; notes: string; sourceBatchId: string; movedAt: string; movedBy: string }

function safeStr(v: unknown, fallback = ''): string {
  return v != null ? String(v) : fallback
}

export default function ProspectsPage() {
  const { status: authStatus } = useSession()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')

  async function fetchData() {
    setLoading(true)
    setFetchError('')
    try {
      const r = await fetch('/api/broker?type=prospects')
      if (r.ok) setProspects((await r.json()).prospects ?? [])
      else setFetchError('Failed to load prospects')
    } catch {
      setFetchError('Network error — check your connection')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const filtered = search ? prospects.filter(p =>
    (safeStr(p.email)).toLowerCase().includes(search.toLowerCase()) ||
    (safeStr(p.companyName)).toLowerCase().includes(search.toLowerCase()) ||
    (safeStr(p.contactName)).toLowerCase().includes(search.toLowerCase())
  ) : prospects

  function formatDate(d: string): string {
    if (!d) return '—'
    const date = new Date(d)
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Interested Prospects</h1>
        <p className="text-xs text-zinc-600">{prospects.length} prospects · emails that showed interest</p>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects..."
          className="w-full max-w-md rounded-md border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
        {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}
        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50">
          {filtered.length === 0 && !fetchError ? (
            <p className="px-4 py-8 text-center text-xs text-zinc-700">No prospects yet. Mark emails as Interested in Shipper Outreach to add them here.</p>
          ) : filtered.length === 0 && fetchError ? null : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.email} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-zinc-300">{safeStr(p.email)}</td>
                      <td className="px-4 py-3 text-zinc-400">{safeStr(p.companyName, '—')}</td>
                      <td className="px-4 py-3 text-zinc-400">{safeStr(p.contactName, '—')}</td>
                      <td className="px-4 py-3 text-zinc-500">{safeStr(p.phone, '—')}</td>
                      <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{safeStr(p.notes, '—')}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(p.movedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
