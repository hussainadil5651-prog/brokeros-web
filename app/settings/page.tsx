'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [outreachSheetIds, setOutreachSheetIds] = useState('')
  const [loadSheetTabs, setLoadSheetTabs] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/user/config').then(r => r.json()).then(data => {
      setOutreachSheetIds(data.outreachSheetIds?.join(', ') ?? '')
      setLoadSheetTabs(data.loadSheetTabs?.join(', ') ?? '')
      setCompanyName(data.companyName ?? '')
      setName(data.name ?? session.user?.name ?? '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [status, router, session])

  async function handleSave() {
    setSaving(true); setMessage(null)
    try {
      const ids = outreachSheetIdList()
      const tabs = loadSheetTabList()
      const res = await fetch('/api/user/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outreachSheetIds: ids,
          loadSheetTabs: tabs,
          companyName: companyName.trim(),
          name,
          setupComplete: true,
        })
      })
      if (res.ok) setMessage({ type: 'success', text: 'Settings saved successfully' }); else setMessage({ type: 'error', text: 'Failed to save settings' })
    } catch { setMessage({ type: 'error', text: 'Failed to save settings' }) } finally { setSaving(false) }
  }

  function extractId(input: string): string {
    const trimmed = input.trim()
    if (/^1[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/)
    if (match) return match[1]
    return trimmed
  }
  function outreachSheetIdList(): string[] { return outreachSheetIds.split(',').map(s => extractId(s.trim())).filter(Boolean) }
  function loadSheetTabList(): string[] { return loadSheetTabs.split(',').map(s => s.trim()).filter(Boolean) }

  async function handleTestOutreach() {
    setTestResult(null); const ids = outreachSheetIdList()
    if (ids.length === 0) { setTestResult({ ok: false, text: 'No sheet IDs configured' }); return }
    try {
      const res = await fetch('/api/user/config/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetId: ids[0] }) })
      const data = await res.json()
      if (res.ok) setTestResult({ ok: true, text: `Connected! Found ${data.sheets ?? 0} tab(s), ${data.totalEmails ?? 0} total email(s)` })
      else setTestResult({ ok: false, text: data.error || 'Failed to connect' })
    } catch { setTestResult({ ok: false, text: 'Failed to connect to sheet' }) }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure your sheets and preferences</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">

        {/* Load Sheet */}
        <div className="card p-5">
          <div className="border-b border-[#e8e6e1] px-5 py-3 -mx-5 -mt-5 mb-5">
            <h2 className="text-sm font-semibold text-[#1a1917]">Load Data Sheet</h2>
            <p className="mt-0.5 text-xs text-[#9a9589]">Shared across all users. Configured by admin via LOAD_SHEET_ID environment variable.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="kpi-label">Company Name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="input w-full" placeholder="e.g. My Freight Brokerage" />
            </div>
            <div>
              <label className="kpi-label">Tab Names (optional)</label>
              <input value={loadSheetTabs} onChange={e => setLoadSheetTabs(e.target.value)} className="input w-full" placeholder="CW, ST (leave empty to auto-detect all tabs)" />
              <p className="mt-1 text-xs text-[#9a9589]">Comma-separated. Leave empty to auto-detect all tabs in the shared load sheet.</p>
            </div>
          </div>
        </div>

        {/* Outreach Sheets */}
        <div className="card p-5">
          <div className="border-b border-[#e8e6e1] px-5 py-3 -mx-5 -mt-5 mb-5">
            <h2 className="text-sm font-semibold text-[#1a1917]">Outreach Sheets</h2>
            <p className="mt-0.5 text-xs text-[#9a9589]">Enter the Google Sheet ID(s) that contain email addresses for your outreach batches. Separate multiple IDs with commas.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="kpi-label">Outreach Sheet IDs</label>
              <textarea value={outreachSheetIds} onChange={e => setOutreachSheetIds(e.target.value)} className="input w-full" rows={3} placeholder="1ABCxyz..., 2DEFabc..." />
              <p className="mt-1 text-xs text-[#9a9589]">Share each sheet with the service account email shown in your deployment env vars.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleTestOutreach} className="btn-secondary">Test Connection</button>
            </div>
            {testResult && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{testResult.text}</div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</button>
          {message && <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{message.text}</p>}
        </div>

        {/* Account */}
        <div className="flex items-center justify-between rounded-xl border border-[#e8e6e1] bg-white px-5 py-3">
          <div>
            <p className="text-sm text-[#6b6960]">Signed in as <span className="text-[#1a1917]">{session?.user?.email}</span></p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary">Sign out</button>
        </div>
      </div>
    </main>
  )
}
