import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { savedLinks, getAllLinks, removeLink } from './store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ sheets: getAllLinks() })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action, id, sheetId, name } = body

  if (action === 'delete' && id) {
    removeLink(id)
    return NextResponse.json({ deleted: true })
  }

  if (action === 'add' && sheetId) {
    const uniqueKey = sheetId
    if (savedLinks.has(uniqueKey)) {
      return NextResponse.json({ error: 'Sheet already added' }, { status: 409 })
    }
    const entry = {
      id: uniqueKey,
      sheetId,
      name: name || sheetId,
      addedAt: new Date().toISOString(),
    }
    savedLinks.set(uniqueKey, entry)
    return NextResponse.json({ sheet: entry })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
