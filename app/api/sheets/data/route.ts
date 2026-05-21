import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, SHARED_SHEET_ID, getClient } from '@/lib/google-sheets'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sheetId = searchParams.get('sheetId')
    const tabName = searchParams.get('tabName')

    if (sheetId && tabName) {
      const rows = await getSheetData(sheetId, `${tabName}!A:Z`)
      return NextResponse.json({
        sheets: [{ tab: tabName, allRows: rows, headers: rows[0] ?? [], sheetId }],
      })
    }

    if (sheetId) {
      const sheets = getClient()
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
      const tabs = (meta.data.sheets ?? []).map(s => s.properties?.title).filter(Boolean) as string[]
      const result: { tab: string; allRows: string[][]; headers: string[]; sheetId: string }[] = []
      for (const tab of tabs) {
        const rows = await getSheetData(sheetId, `${tab}!A:Z`)
        result.push({ tab, allRows: rows, headers: rows[0] ?? [], sheetId })
      }
      return NextResponse.json({ sheets: result })
    }

    const tabs = ['CW', 'ST']
    const result: { tab: string; allRows: string[][]; headers: string[] }[] = []

    for (const tab of tabs) {
      const rows = await getSheetData(SHARED_SHEET_ID, `${tab}!A:R`)
      const headers = rows[0] ?? []
      result.push({ tab, allRows: rows, headers })
    }

    return NextResponse.json({ sheets: result })
  } catch (err: any) {
    const message = String(err?.message ?? err)
    if (message.includes('not found') || message.includes('Unable') || message.includes('parse')) {
      const detail = message.slice(0, 120)
      return NextResponse.json({ error: `Sheet access error: ${detail}` }, { status: 400 })
    }
    if (message.includes('permission') || message.includes('access') || message.includes('403')) {
      return NextResponse.json({ error: `Access denied: ${message.slice(0, 120)}. Share the sheet (with Edit permission) to afa-sheets@afa-dispatch.iam.gserviceaccount.com` }, { status: 403 })
    }
    return NextResponse.json({ error: `Connection failed: ${message.slice(0, 200)}` }, { status: 500 })
  }
}
