import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCarriers } from '@/lib/shared-store'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const search = searchParams.get('search')

    const carriers = await getCarriers()

    if (id) {
      const carrier = carriers.find((c) => c.id === id)
      if (!carrier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ carrier })
    }

    if (search) {
      const q = search.toLowerCase()
      const filtered = carriers.filter(
        (c) => c.companyName.toLowerCase().includes(q) || c.mcNumber.toLowerCase().includes(q),
      )
      return NextResponse.json({ carriers: filtered })
    }

    return NextResponse.json({ carriers })
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
    const { companyName, mcNumber, phone, email, contactName } = body
    if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400 })

    // Carriers are derived from loads data in the shared store.
    // For now, store new carriers in-memory alongside the extracted ones.
    const carriers = await getCarriers()
    const id = `carrier-manual-${Date.now()}`
    const newCarrier = {
      id,
      mcNumber: mcNumber || '',
      companyName,
      contactName: contactName || '',
      phone: phone || '',
      email: email || '',
      equipmentTypes: [] as string[],
      lanes: [] as string[],
      insuranceExpiry: null as string | null,
      insuranceStatus: 'unknown' as const,
      rating: 3,
      notes: 'Added manually',
      createdAt: new Date().toISOString(),
    }
    carriers.push(newCarrier)

    return NextResponse.json({ carrier: newCarrier })
  } catch (error) {
    console.error('POST /api/carriers:', error)
    return NextResponse.json({ error: 'Failed to create carrier' }, { status: 500 })
  }
}
