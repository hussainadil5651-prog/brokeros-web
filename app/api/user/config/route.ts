import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readUserConfig, writeUserConfig } from '@/lib/app-sheet'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readUserConfig(session.user.email)
  return NextResponse.json({
    name: config?.name ?? session.user.name ?? '',
    outreachSheetIds: config?.outreachSheetIds ?? [],
    email: session.user.email,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, outreachSheetIds } = body

  await writeUserConfig(
    session.user.email,
    name ?? session.user.name ?? '',
    Array.isArray(outreachSheetIds) ? outreachSheetIds : [],
  )

  return NextResponse.json({ ok: true })
}
