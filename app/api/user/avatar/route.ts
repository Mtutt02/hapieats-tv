import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
    }

    const service = createServiceClient()

    // Ensure the avatars bucket exists (public)
    const { data: buckets } = await service.storage.listBuckets()
    if (!buckets?.find(b => b.name === 'avatars')) {
      await service.storage.createBucket('avatars', { public: true })
    }

    // Upload to Supabase Storage — overwrite the user's existing avatar
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await service.storage
      .from('avatars')
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[avatar upload]', uploadError)
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = service.storage.from('avatars').getPublicUrl(path)
    // Add cache-buster so the browser picks up the new image immediately
    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

    // Update the profile
    const { error: updateError } = await service
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('[avatar profile update]', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ avatarUrl })
  } catch (err) {
    console.error('[avatar route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
