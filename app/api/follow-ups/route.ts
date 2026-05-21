import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getFollowUpsDueToday, getUpcomingFollowUps, getAllFollowUps, markFollowUpCompleted } from '@/lib/response-store'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') ?? 'today'
  const userId = session.user.email

  let followUps
  if (scope === 'today') followUps = await getFollowUpsDueToday(userId)
  else if (scope === 'upcoming') followUps = await getUpcomingFollowUps(7, userId)
  else followUps = await getAllFollowUps(userId)

  return NextResponse.json({ followUps })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { followUpId, completed } = body
  if (!followUpId) return NextResponse.json({ error: 'Missing followUpId' }, { status: 400 })
  if (completed) await markFollowUpCompleted(followUpId, session.user.email)

  return NextResponse.json({ success: true })
}
