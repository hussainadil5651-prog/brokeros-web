import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllFollowUps } from '@/lib/response-store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = await getAllFollowUps(session.user.email)
  const today = new Date().toISOString().split('T')[0]
  const overdue = all.filter(f => !f.completed && f.dueDate < today)
  const dueToday = all.filter(f => !f.completed && f.dueDate === today)
  const upcoming = all.filter(f => !f.completed && f.dueDate > today)

  return NextResponse.json({ overdue: overdue.length, today: dueToday.length, upcoming: upcoming.length, total: all.filter(f => !f.completed).length })
}
