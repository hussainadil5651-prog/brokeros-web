import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logResponse, getBatchResponses, getResponseStats } from '@/lib/response-store'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { batchId, email, response, notes, followUpDate } = body
  if (!batchId || !email || !response) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const validResponses = ['interested', 'not_interested', 'follow_up', 'wrong_contact', 'bounced', 'quote_received']
  if (!validResponses.includes(response)) return NextResponse.json({ error: 'Invalid response type' }, { status: 400 })

  const entry = await logResponse(batchId, email, response, notes ?? '', followUpDate ?? null, session.user.email)
  return NextResponse.json({ response: entry })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')

  if (batchId) {
    const batchResponses = await getBatchResponses(batchId, session.user.email)
    const stats = await getResponseStats(batchId, session.user.email)
    return NextResponse.json({ responses: batchResponses, stats })
  }

  return NextResponse.json({ responses: [] })
}
