import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDocuments, addDocument, deleteDocument } from '@/lib/document-store'

export async function GET(req: NextRequest, { params }: { params: { loadId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docs = await getDocuments(params.loadId)
  return NextResponse.json({ documents: docs })
}

export async function POST(req: NextRequest, { params }: { params: { loadId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const docType = (formData.get('docType') as string) || 'OTHER'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const validTypes = ['BOL', 'RC', 'POD', 'CreditApp', 'OTHER']
  if (!validTypes.includes(docType)) return NextResponse.json({ error: 'Invalid docType' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mimeType = file.type || 'application/octet-stream'
  const dataUrl = `data:${mimeType};base64,${base64}`

  const doc = await addDocument(
    params.loadId,
    '',
    docType as any,
    file.name,
    session.user.email,
    '',
    dataUrl,
  )

  return NextResponse.json({ document: doc })
}

export async function DELETE(req: NextRequest, { params }: { params: { loadId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  const ok = await deleteDocument(docId)
  if (!ok) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
