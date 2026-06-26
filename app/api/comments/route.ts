import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addComment, getComments } from '@/lib/response-store'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, batchId, text } = body
  if (!email || !text) return NextResponse.json({ error: 'email and text are required' }, { status: 400 })

  const comment = await addComment(email, batchId ?? '', text, session.user.email)
  return NextResponse.json({ comment })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const batchId = searchParams.get('batchId')
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const comments = await getComments(email, batchId ?? '')
  return NextResponse.json({ comments })
}
