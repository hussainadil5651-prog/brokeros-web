import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInvoices, getPayoutForecast, getLoads, invalidateCache } from '@/lib/shared-store'
import { updateInvoiceStatusInSheet } from '@/lib/google-sheets'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const scope = searchParams.get('scope')

    if (scope === 'forecast') {
      const forecast = await getPayoutForecast()
      return NextResponse.json({ forecast })
    }

    const invoices = await getInvoices()
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

    const body = await req.json()
    const { invoiceId, paidDate } = body
    if (!invoiceId || !paidDate) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const invoices = await getInvoices()
    const inv = invoices.find((i) => i.id === invoiceId)
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await updateInvoiceStatusInSheet(inv.loadNumber, 'Invoice Cleared')
    invalidateCache()

    const fresh = (await getInvoices()).find((i) => i.id === invoiceId)
    return NextResponse.json({ invoice: fresh })
  } catch (error) {
    console.error('PATCH /api/invoices:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
