import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SYSTEM_PROMPT, getMockResponse, setLastAiError, getLastAiError } from '@/lib/ai'

async function tryGroq(messages: { role: string; content: string }[]): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || groqKey === 'your-groq-api-key-here') { setLastAiError('Groq key not configured'); return null }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    })
    if (!res.ok) {
      const e = await res.text()
      setLastAiError(`Groq error (${res.status}): ${e.slice(0, 120)}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch (e) {
    setLastAiError(`Groq exception: ${e}`)
    return null
  }
}

async function tryGemini(messages: { role: string; content: string }[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsg = messages.find(m => m.role === 'user')?.content ?? ''

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemMsg}\n\nUser query: ${userMsg}\n\nRespond helpfully and concisely as a freight broker co-pilot.` }],
        }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
      }),
    })
    if (!res.ok) {
      const e = await res.text()
      setLastAiError(`Gemini error (${res.status}): ${e.slice(0, 120)}`)
      return null
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch (e) {
    setLastAiError(`Gemini exception: ${e}`)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { message, context, mode } = body
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const fullMessage = mode === 'email_reply'
    ? `${context ? `Context: ${context}\n\n` : ''}${message}`
    : message

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: fullMessage },
  ]

  const groqReply = await tryGroq(messages)
  if (groqReply) return NextResponse.json({ reply: groqReply, source: 'groq' })

  const geminiReply = await tryGemini(messages)
  if (geminiReply) return NextResponse.json({ reply: geminiReply, source: 'gemini' })

  setLastAiError('Groq and Gemini both failed — see details above')
  const reply = getMockResponse(fullMessage, message, {
    lastError: getLastAiError(),
    hasDeepSeek: false,
    hasOpenAI: false,
    hasGemini: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here',
  })
  return NextResponse.json({ reply, source: 'mock' })
  } catch (e) {
    setLastAiError(`AI route error: ${e}`)
    return NextResponse.json({ reply: getMockResponse('', '', { lastError: String(e), hasDeepSeek: false, hasOpenAI: false, hasGemini: false }), source: 'mock' })
  }
}
