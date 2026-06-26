import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserConfig, saveUserConfig } from '@/lib/config'
import { extractSheetId } from '@/lib/google-sheets'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getUserConfig(session.user.email)
  return NextResponse.json({
    name: config.name || (session.user.name ?? ''),
    outreachSheetIds: config.outreachSheetIds,
    loadSheetId: config.loadSheetId,
    loadSheetTabs: config.loadSheetTabs,
    companyName: config.companyName,
    setupComplete: config.setupComplete,
    email: session.user.email,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, outreachSheetIds, loadSheetId, loadSheetTabs, companyName, setupComplete } = body

  const cleanedIds = Array.isArray(outreachSheetIds)
    ? outreachSheetIds.map((id: string) => extractSheetId(id)).filter(Boolean)
    : []

  await saveUserConfig(session.user.email, {
    name: name ?? session.user.name ?? '',
    outreachSheetIds: cleanedIds,
    loadSheetId: loadSheetId ? extractSheetId(loadSheetId) : undefined,
    loadSheetTabs: Array.isArray(loadSheetTabs) ? loadSheetTabs : undefined,
    companyName: companyName ?? undefined,
    setupComplete: setupComplete ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
