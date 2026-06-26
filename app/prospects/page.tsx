'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Prospect { email: string; companyName: string; contactName: string; phone: string; notes: string; sourceBatchId: string; movedAt: string; movedBy: string }

function safeStr(v: unknown, fallback = ''): string { return v != null ? String(v) : fallback }

export default function ProspectsPage() {
  const { status: authStatus } = useSession()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')

  async function fetchData() {
    setLoading(true); setFetchError('')
    try { const r = await fetch('/api/broker?type=prospects'); if (r.ok) setProspects((await r.json()).prospects ?? []); else setFetchError('Failed to load prospects') }
    catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  const filtered = search ? prospects.filter(p =>
    (safeStr(p.email)).toLowerCase().includes(search.toLowerCase()) ||
    (safeStr(p.companyName)).toLowerCase().includes(search.toLowerCase()) ||
    (safeStr(p.contactName)).toLowerCase().includes(search.toLowerCase())
  ) : prospects

  function formatDate(d: string): string { if (!d) return '—'; const date = new Date(d); return isNaN(date.getTime()) ? '—' : date.toLocaleDateString() }

  return (
    <main className="page-container">
      <div className="section-header">
        <h1 className="page-title">Interested Prospects</h1>
        <p className="page-subtitle">{prospects.length} prospects · emails that showed interest</p>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects..." className="input max-w-md" />
        {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}
        <div className="card">
          {filtered.length === 0 && !fetchError ? (
            <p className="px-4 py-8 text-center text-xs text-[#9a9589]">No prospects yet. Mark emails as Interested in Shipper Outreach to add them here.</p>
          ) : filtered.length === 0 && fetchError ? null : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Email</th><th>Company</th><th>Contact</th><th>Phone</th><th>Notes</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.email}>
                      <td className="font-mono text-[#1a1917]">{safeStr(p.email)}</td>
                      <td className="text-[#6b6960]">{safeStr(p.companyName, '—')}</td>
                      <td className="text-[#6b6960]">{safeStr(p.contactName, '—')}</td>
                      <td className="text-[#9a9589]">{safeStr(p.phone, '—')}</td>
                      <td className="text-[#9a9589] max-w-[200px] truncate">{safeStr(p.notes, '—')}</td>
                      <td className="text-[#9a9589]">{formatDate(p.movedAt)}</td>
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
