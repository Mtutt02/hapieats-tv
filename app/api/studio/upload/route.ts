import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 200 * 1024 * 1024 // 200 MB
const ALLOWED = ['video/', 'image/', 'audio/']

export async function POST(req: NextRequest) {
  try {
    // Auth required — this endpoint writes to the public webroot.
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!ALLOWED.some(p => file.type.startsWith(p))) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (200 MB max)' }, { status: 413 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const fileName = `${Date.now()}-${safeName}`
    await writeFile(path.join(uploadDir, fileName), buffer)

    return NextResponse.json({ success: true, url: `/uploads/${fileName}`, name: file.name, size: file.size, type: file.type })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
