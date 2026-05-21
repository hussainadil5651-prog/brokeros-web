import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, findEmailColumn, extractEmails } from '@/lib/google-sheets'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sheetId } = body
  if (!sheetId) return NextResponse.json({ error: 'sheetId is required' }, { status: 400 })

  try {
    const sheets = getClient()
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const sheetList = (meta.data.sheets ?? []).map(s => s.properties?.title).filter(Boolean) as string[]

    let totalEmails = 0
    for (const name of sheetList) {
      const range = `${name}!A:Z`
      const raw = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range })
      const allRows = raw.data.values ?? []
      if (allRows.length < 2) continue
      const headers = allRows[0].map(c => String(c ?? ''))
      const dataRows = allRows.slice(1).filter(r => r.some(c => String(c ?? '').trim()))
      if (dataRows.length === 0) continue
      const emailCol = findEmailColumn(headers, dataRows)
      const emails = extractEmails(dataRows)
      totalEmails += emails.length
    }

    return NextResponse.json({ sheets: sheetList.length, totalEmails })
  } catch (err: any) {
    const message = err?.message ?? String(err)
    if (message.includes('not found') || message.includes('Unable')) {
      return NextResponse.json({ error: 'Sheet not found. Make sure the ID is correct and shared with the service account.' }, { status: 400 })
    }
    if (message.includes('permission') || message.includes('access')) {
      return NextResponse.json({ error: 'Access denied. Share the sheet with afa-sheets@afa-dispatch.iam.gserviceaccount.com' }, { status: 403 })
    }
    return NextResponse.json({ error: `Connection failed: ${message.slice(0, 100)}` }, { status: 500 })
  }
}
