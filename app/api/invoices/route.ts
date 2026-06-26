import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInvoices, getPayoutForecast, getLoads, invalidateCache } from '@/lib/shared-store'
import { updateInvoiceStatusInSheet } from '@/lib/google-sheets'
import { requireLoadSheet } from '@/lib/config'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let sheetId = ''
    try {
      const cfg = await requireLoadSheet(session.user.email)
      sheetId = cfg.sheetId
    } catch {
      return NextResponse.json({ invoices: [], forecast: null })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const scope = searchParams.get('scope')

    if (scope === 'forecast') {
      const forecast = await getPayoutForecast(sheetId)
      return NextResponse.json({ forecast })
    }

    const invoices = await getInvoices(sheetId)
    if (id) return NextResponse.json({ invoice: invoices.find((i) => i.id === id) ?? null })
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('GET /api/invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sheetId } = await requireLoadSheet(session.user.email)

    const body = await req.json()
    const { invoiceId, paidDate } = body
    if (!invoiceId || !paidDate) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const invoices = await getInvoices(sheetId)
    const inv = invoices.find((i) => i.id === invoiceId)
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await updateInvoiceStatusInSheet(sheetId, inv.loadNumber, 'Invoice Cleared')
    invalidateCache(sheetId)

    const fresh = (await getInvoices(sheetId)).find((i) => i.id === invoiceId)
    return NextResponse.json({ invoice: fresh })
  } catch (error: any) {
    if (error?.message?.includes('No load sheet configured')) {
      return NextResponse.json({ error: error.message, setupRequired: true }, { status: 400 })
    }
    console.error('PATCH /api/invoices:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
