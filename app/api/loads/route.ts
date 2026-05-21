import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLoads, getLoadById, getLoadsByStatus, refreshFromSheet, invalidateCache, type LoadStatus } from '@/lib/shared-store'
import { updateLoadStatusInSheet, updateInvoiceStatusInSheet, appendLoadToSheet } from '@/lib/google-sheets'
import { logActivity } from '@/lib/activity-store'

const VALID_STATUSES: LoadStatus[] = ['quote', 'booked', 'dispatched', 'in_transit', 'delivered', 'invoiced', 'paid']

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')

    if (id) {
      const load = await getLoadById(id)
      if (!load) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ load })
    }

    const loads = status && VALID_STATUSES.includes(status as LoadStatus)
      ? await getLoadsByStatus(status as LoadStatus)
      : await getLoads()
    return NextResponse.json({ loads })
  } catch (error) {
    console.error('GET /api/loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { customerName, pickUpLocation, pickUpDate, deliveryLocation, deliveryDate, carrierName, mcNumber, rate, carrierCost, equipmentType, company } = body

    if (!customerName || !pickUpLocation || !deliveryLocation || !rate) {
      return NextResponse.json({ error: 'Missing required fields (customerName, pickUpLocation, deliveryLocation, rate)' }, { status: 400 })
    }

    const tabName = company === 'ST' ? 'ST' : 'CW'
    const mode = equipmentType || ''

    const result = await appendLoadToSheet(tabName, {
      mode,
      customerName,
      pickUpDate: pickUpDate || new Date().toISOString().split('T')[0],
      pickUpLocation,
      deliveryLocation,
      rate: Number(rate),
      carrierCost: Number(carrierCost || 0),
      carrierName: carrierName || '',
      mcNumber: mcNumber || '',
      status: 'Quote',
    })

    if (!result) {
      return NextResponse.json({ error: 'Failed to append to sheet' }, { status: 500 })
    }

    invalidateCache()
    await refreshFromSheet()
    const all = await getLoads()
    const fresh = all.find(l => l.loadNumber === result.proNo) ?? all[all.length - 1]

    return NextResponse.json({ load: fresh ?? null })
  } catch (error) {
    console.error('POST /api/loads:', error)
    return NextResponse.json({ error: 'Failed to create load. Check sheet permissions and service account access.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { loadId, status } = body
    if (!loadId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const all = await getLoads()
    const load = all.find((l) => l.id === loadId)
    if (!load) return NextResponse.json({ error: 'Load not found' }, { status: 404 })

    const statusMap: Record<string, string> = {
      quote: 'Quote', booked: 'Booked', dispatched: 'Dispatched',
      in_transit: 'In Transit', delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid',
    }

    const sheetStatus = statusMap[status] || status

    const updated = await updateLoadStatusInSheet(load.loadNumber, sheetStatus)
    if (!updated) return NextResponse.json({ error: 'Failed to update sheet' }, { status: 500 })

    const oldStatus = load.status
    logActivity(loadId, {
      type: 'status_change',
      message: `${oldStatus} → ${status}`,
      actor: session.user.email ?? 'system',
    })

    if (status === 'paid') {
      await updateInvoiceStatusInSheet(load.loadNumber, 'Invoice Cleared')
    }

    invalidateCache()
    const freshLoads = await getLoads()
    const fresh = freshLoads.find((l) => l.id === loadId)

    return NextResponse.json({ load: fresh })
  } catch (error) {
    console.error('PATCH /api/loads:', error)
    return NextResponse.json({ error: 'Failed to update load status' }, { status: 500 })
  }
}
