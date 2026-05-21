import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createFileBatches } from '@/lib/file-import'
import { storeBatch } from './store'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { emails, fileName, emailColumn } = body

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const batches = createFileBatches(emails, 30, today, session.user.email)

  for (const b of batches) {
    await storeBatch(b, session.user.email)
  }

  const batchList = batches.map((b) => ({
    id: b.id,
    batchDate: b.batchDate,
    batchNumber: b.batchNumber,
    assignedTo: b.assignedTo,
    status: b.status,
    totalEmails: b.totalEmails,
    createdAt: b.createdAt,
  }))

  return NextResponse.json({
    fileName: fileName ?? 'Uploaded file',
    emailColumn: emailColumn ?? 'Auto-detected',
    totalEmails: emails.length,
    batchesCreated: batches.length,
    batchDate: today,
    batches: batchList,
  })
}
