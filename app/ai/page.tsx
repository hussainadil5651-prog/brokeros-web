'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface ChatMessage { role: 'user' | 'assistant'; content: string; source?: string }

const QUICK_PROMPTS = [
  'Draft a cold email to a shipper',
  'What are current van rates?',
  'How to handle a rate dispute?',
  'Generate a carrier call script',
  'What documents do I need for a load?',
  'Explain brokerage margins',
]

export default function AIPage() {
  const { status: authStatus } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hey, I\'m your freight broker AI co-pilot. Ask me anything about rates, emails, carriers, or brokerage.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(msg: string) {
    if (!msg.trim() || loading) return
    const userMsg = msg.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      if (r.ok) {
        const d = await r.json()
        setMessages(prev => [...prev, { role: 'assistant', content: d.reply, source: d.source }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process that. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Check your connection and try again.' }])
    } finally { setLoading(false) }
  }

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center gap-3">
          <div className="perspective-500">
            <svg viewBox="0 0 48 48" className="h-7 w-7" style={{ transformStyle: 'preserve-3d' }}>
              <defs><linearGradient id="aiCab" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient></defs>
              <rect x="6" y="14" width="22" height="16" rx="2" fill="#1c1917" stroke="#44403c" strokeWidth="0.6" />
              <path d="M28 16 L28 28 L40 28 L40 22 L36 16 Z" fill="url(#aiCab)" stroke="#d97706" strokeWidth="0.6" />
              <text x="16" y="27" fontSize="7" fill="#f59e0b" textAnchor="middle" fontWeight="bold">AI</text>
              <circle cx="12" cy="30" r="3" fill="#292524" stroke="#1c1917" strokeWidth="0.6" />
              <circle cx="24" cy="30" r="3" fill="#292524" stroke="#1c1917" strokeWidth="0.6" />
              <circle cx="36" cy="30" r="3" fill="#292524" stroke="#1c1917" strokeWidth="0.6" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">AI Co-Pilot</h1>
            <p className="text-xs text-zinc-600">Expert freight broker assistant — rates, emails, scripts, everything</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-amber-500/10 border border-amber-500/20 text-zinc-200'
                : 'bg-zinc-900/70 border border-white/[0.06] text-zinc-300'
            }`}>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.source && msg.role === 'assistant' && (
                <p className={`mt-1 text-[9px] font-mono ${
                  msg.source === 'openai' ? 'text-emerald-600' :
                  msg.source === 'gemini' ? 'text-blue-400' :
                  'text-zinc-700'
                }`}>
                  {msg.source === 'openai' ? '⚡ GPT-4o-mini' : msg.source === 'gemini' ? '✦ Gemini 2.0 Flash' : '💡 Built-in'}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-zinc-900/70 border border-white/[0.06] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-thin">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessage(p)} disabled={loading}
            className="flex-shrink-0 rounded-full border border-white/[0.06] px-3 py-1 text-[10px] text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300 transition press whitespace-nowrap">
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Ask about rates, draft emails, get advice..."
            className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 press disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
    </main>
  )
}
