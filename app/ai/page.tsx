'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface ChatMessage { role: 'user' | 'assistant'; content: string; source?: string }

const QUICK_PROMPTS = ['Draft a cold email to a shipper', 'What are current van rates?', 'How to handle a rate dispute?', 'Generate a carrier call script', 'What documents do I need for a load?', 'Explain brokerage margins']

export default function AIPage() {
  const { status: authStatus } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Hey, I\'m your freight broker AI co-pilot. Ask me anything about rates, emails, carriers, or brokerage.' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(msg: string) {
    if (!msg.trim() || loading) return; const userMsg = msg.trim(); setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]); setLoading(true)
    try { const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg }) }); if (r.ok) { const d = await r.json(); setMessages(prev => [...prev, { role: 'assistant', content: d.reply, source: d.source }]) } else setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process that. Please try again.' }]) }
    catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Check your connection and try again.' }]) } finally { setLoading(false) }
  }

  if (authStatus === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  return (
    <main className="min-h-screen bg-[#f8f7f4] flex flex-col">
      <div className="border-b border-[#e8e6e1] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 text-sm font-bold">AI</div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#1a1917]">AI Co-Pilot</h1>
            <p className="text-xs text-[#9a9589]">Expert freight broker assistant — rates, emails, scripts, everything</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
              msg.role === 'user' ? 'bg-amber-50 border border-amber-200 text-[#1a1917]' : 'bg-white border border-[#e8e6e1] text-[#6b6960]'
            }`}>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.source && msg.role === 'assistant' && (
                <p className={`mt-1 text-[9px] font-mono ${msg.source === 'openai' ? 'text-emerald-600' : msg.source === 'gemini' ? 'text-blue-600' : 'text-[#9a9589]'}`}>
                  {msg.source === 'openai' ? '⚡ GPT-4o-mini' : msg.source === 'gemini' ? '✦ Gemini 2.0 Flash' : '💡 Built-in'}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white border border-[#e8e6e1] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full bg-[#d6d4cc]" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-[#d6d4cc]" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-[#d6d4cc]" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessage(p)} disabled={loading}
            className="flex-shrink-0 rounded-full border border-[#e8e6e1] bg-white px-3 py-1 text-[10px] text-[#6b6960] hover:bg-[#f3f2ee] hover:text-[#1a1917] transition-all whitespace-nowrap disabled:opacity-50">
            {p}
          </button>
        ))}
      </div>

      <div className="border-t border-[#e8e6e1] px-4 py-3 bg-white">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Ask about rates, draft emails, get advice..." className="input flex-1" />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="btn-primary disabled:opacity-40">Send</button>
        </div>
      </div>
    </main>
  )
}
