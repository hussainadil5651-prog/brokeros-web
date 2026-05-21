import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractEmails } from '@/lib/google-sheets'
import { createFileBatches } from '@/lib/file-import'
import { storeBatch } from '@/app/api/batches/import/store'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sheets } = body
  if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
    return NextResponse.json({ error: 'No sheets provided' }, { status: 400 })
  }

  const allEmails: string[] = []
  const today = new Date().toISOString().split('T')[0]

  for (const sheet of sheets) {
    const { headers, rows } = sheet
    if (!headers || !rows) continue
    const emails = extractEmails(rows)
    for (const e of emails) allEmails.push(e)
  }

  if (allEmails.length === 0) return NextResponse.json({ error: 'No valid emails found' }, { status: 400 })

  const unique = Array.from(new Set(allEmails.map((e) => e.toLowerCase())))
  const batches = createFileBatches(unique, 30, today, session.user.email)

  for (const b of batches) {
    await storeBatch(b, session.user.email)
  }

  const batchList = batches.map((b) => ({
    id: b.id, batchDate: b.batchDate, batchNumber: b.batchNumber,
    assignedTo: b.assignedTo, status: b.status, totalEmails: b.totalEmails, createdAt: b.createdAt,
  }))

  return NextResponse.json({
    totalEmails: unique.length, batchesCreated: batches.length, batchDate: today, batches: batchList,
  })
}
