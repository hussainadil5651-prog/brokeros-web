import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readAllSheets, createBatches } from '@/lib/google-sheets'

interface ImportedBatch {
  id: string
  batchDate: string
  batchNumber: number
  emails: string[]
  assignedTo: string
  status: string
  totalEmails: number
  createdAt: string
  sourceSheet: string
}

const importedBatches: ImportedBatch[] = []

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sheetId } = body

  if (!sheetId) {
    return NextResponse.json({ error: 'sheetId is required' }, { status: 400 })
  }

  try {
    const sheets = await readAllSheets(sheetId)
    const today = new Date().toISOString().split('T')[0]
    const newBatches: ImportedBatch[] = []

    for (const sheet of sheets) {
      if (sheet.emails.length === 0) continue
      const batches = createBatches(sheet.emails, 30, today, session.user.email)
      for (const b of batches) {
        newBatches.push({ ...b, sourceSheet: sheet.name })
      }
    }

    importedBatches.push(...newBatches)

    return NextResponse.json({
      totalSheets: sheets.length,
      totalEmails: sheets.reduce((s, sh) => s + sh.emails.length, 0),
      batchesCreated: newBatches.length,
      sheets: sheets.map((s) => ({ name: s.name, emails: s.emails.length })),
    })
  } catch (err: any) {
    const message = err?.message ?? String(err)
    if (message.includes('Missing')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Sheets API error:', err)
    return NextResponse.json(
      { error: 'Failed to read sheet. Make sure the Sheet ID is correct and the service account has access.' },
      { status: 500 },
    )
  }
}
