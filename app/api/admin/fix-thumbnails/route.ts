import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// One-time dev utility: set thumbnail URLs and make seeded videos public.
// Requires superadmin or admin role — never call unauthenticated.
export async function GET() {
  // Auth guard — must be admin/superadmin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const FOOD_THUMBNAILS = [
    'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=640&q=80',
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=640&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=640&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=640&q=80',
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=640&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=640&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=640&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=640&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=640&q=80',
    'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=640&q=80',
    'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=640&q=80',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=640&q=80',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=640&q=80',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=640&q=80',
  ]

  // Only fix videos that have no real Mux playback ID (null or clearly invalid)
  const { data: videos, error: fetchError } = await service
    .from('videos')
    .select('id, mux_playback_id')
    .eq('status', 'ready')
    .is('mux_playback_id', null)  // Only target videos with no playback ID
    .order('created_at', { ascending: true })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!videos?.length) return NextResponse.json({ message: 'No videos to fix', count: 0 })

  const updates = await Promise.all(
    videos.map((v, i) =>
      service.from('videos').update({
        thumbnail_url: FOOD_THUMBNAILS[i % FOOD_THUMBNAILS.length],
        visibility: 'public',
        published_at: new Date().toISOString(),
        // NOTE: mux_playback_id intentionally NOT cleared — only set thumbnails
      }).eq('id', v.id)
    )
  )

  const errors = updates.filter(u => u.error).map(u => u.error?.message)

  return NextResponse.json({
    success: true,
    updated: videos.length,
    errors: errors.length ? errors : undefined,
    message: `Fixed ${videos.length} videos — thumbnails set, visibility=public.`,
  })
}
