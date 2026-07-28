import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/videos/cover  { coverDataUrl }
 * Stores a composed 16:9 cover image (data URL, JPEG/PNG) in the public
 * `covers` bucket and returns its public URL. The caller then saves that
 * URL onto the video record (thumbnail_url).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { coverDataUrl } = await req.json().catch(() => ({}))
    if (typeof coverDataUrl !== 'string' || !coverDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'coverDataUrl must be an image data URL' }, { status: 400 })
    }

    const match = coverDataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/)
    if (!match) return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    const contentType = match[1]
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
    const bytes = Buffer.from(match[3], 'base64')
    if (bytes.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Cover image too large (8 MB max)' }, { status: 413 })
    }

    const service = createServiceClient()

    const { data: buckets } = await service.storage.listBuckets()
    if (!buckets?.find(b => b.name === 'covers')) {
      await service.storage.createBucket('covers', { public: true })
    }

    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await service.storage
      .from('covers')
      .upload(path, bytes, { contentType, upsert: true })

    if (uploadError) {
      console.error('[cover upload]', uploadError)
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }

    const { data: urlData } = service.storage.from('covers').getPublicUrl(path)
    return NextResponse.json({ coverUrl: urlData.publicUrl })
  } catch (err) {
    console.error('[cover route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
