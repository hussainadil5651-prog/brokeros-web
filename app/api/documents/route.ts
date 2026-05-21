import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDocuments, addDocument, deleteDocument, getDocumentMonths } from '@/lib/document-store'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const loadNumber = searchParams.get('loadNumber')
  const scope = searchParams.get('scope')

  if (scope === 'months') {
    const months = await getDocumentMonths()
    return NextResponse.json({ months })
  }

  const docs = await getDocuments(loadNumber ?? undefined)
  return NextResponse.json({ documents: docs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { loadNumber, customerName, docType, fileName, notes, fileRef } = body

  if (!loadNumber || !docType || !fileName) {
    return NextResponse.json({ error: 'loadNumber, docType, and fileName are required' }, { status: 400 })
  }

  const doc = await addDocument(
    loadNumber, customerName || '', docType, fileName,
    session.user.email, notes || '', fileRef || '',
  )

  return NextResponse.json({ document: doc })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'Missing document id' }, { status: 400 })

  const ok = await deleteDocument(docId)
  return NextResponse.json({ ok })
}
