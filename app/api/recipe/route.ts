import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/recipe?video_id=xxx — public, returns recipe if one exists
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('video_id')
  if (!videoId) {
    return NextResponse.json({ error: 'video_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('recipe_cards')
    .select('*')
    .eq('video_id', videoId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows — that's fine, the video just has no recipe
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recipe: data ?? null })
}

// POST /api/recipe — auth required, creator must own the video
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    video_id, title, description, prep_time_minutes, cook_time_minutes,
    servings, difficulty, cuisine_type, dietary_tags, ingredients, steps,
    calories_per_serving,
  } = body

  if (!video_id || !title) {
    return NextResponse.json({ error: 'video_id and title are required' }, { status: 400 })
  }

  // Verify the caller owns the video
  const serviceSupabase = createServiceClient()
  const { data: video } = await serviceSupabase
    .from('videos')
    .select('id, creator_id')
    .eq('id', video_id)
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Upsert (one recipe per video)
  const { data: recipe, error } = await supabase
    .from('recipe_cards')
    .upsert(
      {
        video_id,
        creator_id: user.id,
        title,
        description,
        prep_time_minutes,
        cook_time_minutes,
        servings,
        difficulty,
        cuisine_type,
        dietary_tags,
        ingredients,
        steps,
        calories_per_serving,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'video_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recipe })
}
