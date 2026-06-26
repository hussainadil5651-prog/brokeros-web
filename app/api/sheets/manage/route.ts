import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLinks, removeLink, addLink, hasLink } from './store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sheets = await getAllLinks()
  return NextResponse.json({ sheets })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, id, sheetId, name } = body

    if (action === 'delete' && id) {
      await removeLink(id)
      return NextResponse.json({ deleted: true })
    }

    if (action === 'add' && sheetId) {
      const exists = await hasLink(sheetId)
      if (exists) {
        return NextResponse.json({ error: 'Sheet already added' }, { status: 409 })
      }
      const entry = await addLink(sheetId, name || sheetId)
      return NextResponse.json({ sheet: entry })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: `Invalid request: ${(e as Error).message}` }, { status: 400 })
  }
}
