import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSuppressed, suppressEmail, unsuppressEmail, getSuppressedEmails } from '@/lib/response-store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ suppressed: await getSuppressedEmails(session.user.email) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, action } = body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  if (action === 'suppress') {
    await suppressEmail(email, session.user.email)
    return NextResponse.json({ suppressed: true, email })
  }
  if (action === 'unsuppress') {
    await unsuppressEmail(email, session.user.email)
    return NextResponse.json({ suppressed: false, email })
  }
  return NextResponse.json({ suppressed: await isSuppressed(email, session.user.email), email })
}
