import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCarriers } from '@/lib/shared-store'
import { addCarrierRecord, getAllCarrierRecords, searchCarriers } from '@/lib/broker-store'
import { requireLoadSheet } from '@/lib/config'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const search = searchParams.get('search')
    const userId = session.user.email

    let sheetCarriers: any[] = []
    try {
      const { sheetId } = await requireLoadSheet(userId)
      sheetCarriers = await getCarriers(sheetId)
    } catch {
      // No load sheet configured - just use manual carriers
    }
    const manualCarriers = search ? await searchCarriers(search, userId) : await getAllCarrierRecords(userId)

    const allCarriers = [
      ...sheetCarriers.map(c => ({ ...c, source: 'sheet' as const })),
      ...manualCarriers.map(c => ({
        id: `carrier-manual-${c.mcNumber || c.carrierName}`,
        mcNumber: c.mcNumber,
        companyName: c.carrierName,
        contactName: '',
        phone: '',
        email: '',
        equipmentTypes: [] as string[],
        lanes: c.lane ? [c.lane] : [],
        insuranceExpiry: null as string | null,
        insuranceStatus: 'unknown' as const,
        rating: 3,
        notes: `Lane: ${c.lane} | Price: $${c.price} | Load: ${c.loadNumber}`,
        createdAt: c.date || new Date().toISOString(),
        source: 'manual' as const,
      })),
    ]

    if (id) {
      const carrier = allCarriers.find((c) => c.id === id)
      if (!carrier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ carrier })
    }

    if (search) {
      const q = search.toLowerCase()
      const filtered = allCarriers.filter(
        (c) => c.companyName.toLowerCase().includes(q) || c.mcNumber.toLowerCase().includes(q),
      )
      return NextResponse.json({ carriers: filtered })
    }

    return NextResponse.json({ carriers: allCarriers })
  } catch (error) {
    console.error('GET /api/carriers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { companyName, mcNumber, phone, email, contactName, lane, customerName, price, loadNumber } = body
    if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400 })

    const userId = session.user.email
    const rec = await addCarrierRecord(
      companyName,
      mcNumber || '',
      lane || '',
      customerName || '',
      price || 0,
      loadNumber || '',
      new Date().toISOString().split('T')[0],
      userId,
    )

    return NextResponse.json({ carrier: {
      id: `carrier-manual-${rec.mcNumber || rec.carrierName}`,
      mcNumber: rec.mcNumber,
      companyName: rec.carrierName,
      contactName: '',
      phone: phone || '',
      email: email || '',
      equipmentTypes: [],
      lanes: rec.lane ? [rec.lane] : [],
      insuranceExpiry: null,
      insuranceStatus: 'unknown',
      rating: 3,
      notes: `Lane: ${rec.lane} | Price: $${rec.price} | Load: ${rec.loadNumber}`,
      createdAt: rec.date,
    }})
  } catch (error) {
    console.error('POST /api/carriers:', error)
    return NextResponse.json({ error: 'Failed to create carrier' }, { status: 500 })
  }
}
