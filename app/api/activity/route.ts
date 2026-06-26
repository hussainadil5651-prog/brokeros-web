import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActivity } from '@/lib/activity-store'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const loadId = searchParams.get('loadId')
  if (!loadId) return NextResponse.json({ error: 'loadId is required' }, { status: 400 })

  const activity = await getActivity(loadId)
  return NextResponse.json({ activity })
}
