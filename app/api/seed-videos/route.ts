import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const CHANNELS = [
  {
    name: 'HapiEats Kitchen',
    slug: 'hapieats-kitchen',
    description: 'Professional cooking techniques and global street food recipes. From Tokyo ramen to Mexico City tacos.',
    creator: { username: 'hapieats_kitchen', display_name: 'HapiEats Kitchen', is_creator: true },
    videos: [
      { title: '🌮 Mexico City Street Tacos', mux_playback_id: 'dmvskEzKGrs102w02kJVFR4iU5YaqOdyvqJ02PCqcs8Q2A', duration: 5, view_count: 92100, description: 'Al pastor style tacos with authentic marinade, grilled pineapple, and fresh salsa verde.' },
      { title: '🍝 Cacio e Pepe the Roman Way', mux_playback_id: 'T8qJDYL2Op7Duubd1AU3EuY4WvDBs6zsoHkMhcib7eY', duration: 10, view_count: 61300, description: 'Three ingredients. Perfect technique. The iconic Roman pasta dish.' },
      { title: '🍕 Neapolitan Pizza in Home Oven', mux_playback_id: 'n02ovn745oH1Tb3TTIy2uKXHwURyz1TX99102czp3zOkE', duration: 15, view_count: 79200, description: 'Authentic Neapolitan pizza using a regular home oven.' },
      { title: '🥐 Croissant Lamination Technique', mux_playback_id: 'u012CRCHrPE9L8ivofYR9utzGHvVvcpJMElXdgQOLhnw', duration: 20, view_count: 37900, description: 'Master the 27-layer lamination process for bakery-quality croissants.' },
      { title: '🍣 Sushi Rice Master Class', mux_playback_id: 'E47QYUZjRAOYDvxxCvfBmLQnVpUVEBDC00WDQlhKO3cs', duration: 30, view_count: 31700, description: 'Learn the art of perfect sushi rice from a Tokyo-trained chef.' },
      { title: '🔥 Smash Burger with Wagyu Beef', mux_playback_id: '1KXwX7drllI1r1lQj7Naq7EIxBfHNoo7VqomGB88PWc', duration: 5, view_count: 54200, description: 'The ultimate smash burger recipe using American Wagyu blend.' },
    ],
  },
  {
    name: 'Soul Food South',
    slug: 'soul-food-south',
    description: 'Southern soul food classics from a third-generation Atlanta chef. Mac and cheese, fried chicken, collard greens.',
    creator: { username: 'soulfood_south', display_name: 'Chef Marcus', is_creator: true },
    videos: [
      { title: '🍗 Southern Fried Chicken Perfection', mux_playback_id: '3A4wmtwbQ008dfYZ6MMaldPjej02NeXo8FZdHB9RTM6jg', duration: 10, view_count: 45600, description: 'Buttermilk brined, perfectly seasoned, crispy golden fried chicken.' },
      { title: '🧀 Smoked Mac and Cheese', mux_playback_id: '8B02TIZ8012AMjUBh02ZJknVdFAuDrg7K01lBuRyB7A3X2A', duration: 15, view_count: 32800, description: 'Three-cheese blend smoked low and slow for that deep southern flavor.' },
    ],
  },
  {
    name: 'Plant Based Kitchen',
    slug: 'plant-based-kitchen',
    description: 'Vegan cooking that actually tastes good. No fake meat, just real plants done right.',
    creator: { username: 'plant_based', display_name: 'Plant Based Kitchen', is_creator: true },
    videos: [
      { title: '🥑 Loaded Vegan Tacos', mux_playback_id: '1RgUyYxwZ2021jfgmZfawOAGNyJVs9bvosMEp1yz2SM8', duration: 20, view_count: 28700, description: 'Plant-based tacos packed with flavor. Jackfruit carnitas, cashew crema.' },
      { title: '🥦 Crispy Tofu Bowl', mux_playback_id: 'aJm5xYF1bLi5X01T2Sxkm3n1GAaDYVjwDD2n7BrHVZTI', duration: 30, view_count: 19300, description: 'Restaurant-quality crispy tofu that even meat-lovers will crave.' },
    ],
  },
]

async function ensureEmailUser(supabase: any, email: string, username: string, displayName: string, isCreator: boolean) {
  // Check if user exists
  const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
  if (existing) return existing.id

  // Create auth user
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email, password: 'Welcome123!', email_confirm: true,
    user_metadata: { username, full_name: displayName },
  })
  if (authErr || !authUser?.user) return null

  // Profile is auto-created by trigger, but update it
  await supabase.from('profiles').update({ is_creator: isCreator }).eq('id', authUser.user.id)
  return authUser.user.id
}

export async function POST() {
  const supabase = createServiceClient()
  const results: any[] = []

  for (const channelData of CHANNELS) {
    // Create or get the creator account
    const email = `${channelData.creator.username}@hapieats.tv`
    const creatorId = await ensureEmailUser(supabase, email, channelData.creator.username, channelData.creator.display_name, channelData.creator.is_creator)
    if (!creatorId) {
      results.push({ channel: channelData.name, error: 'Failed to create user' })
      continue
    }

    // Create or get the channel
    let channelId: string | null = null
    const { data: existingChannel } = await supabase.from('channels').select('id').eq('slug', channelData.slug).maybeSingle()
    if (existingChannel) {
      channelId = existingChannel.id
    } else {
      const { data: newChannel } = await supabase.from('channels').insert({
        creator_id: creatorId, name: channelData.name, slug: channelData.slug,
        description: channelData.description, subscriber_count: Math.floor(Math.random() * 5000) + 500,
        video_count: channelData.videos.length,
      }).select('id').single()
      if (newChannel) channelId = newChannel.id
    }

    if (!channelId) {
      results.push({ channel: channelData.name, error: 'Failed to create channel' })
      continue
    }

    // Add videos to the channel (update playback ID if video exists by title)
    const videoResults: any[] = []
    for (const v of channelData.videos) {
      const { data: existing } = await supabase.from('videos').select('id').eq('title', v.title).maybeSingle()
      if (existing) {
        await supabase.from('videos').update({
          mux_playback_id: v.mux_playback_id,
          thumbnail_url: `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=30`,
        }).eq('id', existing.id)
        videoResults.push({ title: v.title, status: 'updated playback ID' })
        continue
      }
      const { data: created } = await supabase.from('videos').insert({
        channel_id: channelId, creator_id: creatorId,
        title: v.title, description: v.description,
        mux_playback_id: v.mux_playback_id,
        duration: v.duration,
        thumbnail_url: `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=30`,
        pricing_model: 'free', visibility: 'public', status: 'ready',
        view_count: v.view_count, published_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
      }).select('id').single()
      videoResults.push({ title: v.title, status: created ? 'inserted' : 'error' })
    }

    results.push({
      channel: channelData.name,
      account: email,
      password: 'Welcome123!',
      videos: videoResults,
    })
  }

  return NextResponse.json({ results })
}

// DELETE /api/seed-videos — remove stagnant videos without Mux playback IDs
export async function DELETE() {
  const supabase = createServiceClient()
  const { data: stagnant } = await supabase
    .from('videos')
    .select('id, title')
    .is('mux_playback_id', null)
  if (!stagnant || stagnant.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'No stagnant videos' })
  }
  const ids = stagnant.map(v => v.id)
  const { error } = await supabase.from('videos').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: stagnant.length, videos: stagnant })
}

// PATCH /api/seed-videos — reassign all videos to a user by email
export async function PATCH(req: Request) {
  const supabase = createServiceClient()
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // Find the user
  const { data: user } = await supabase.from('profiles').select('id').eq('username', email.split('@')[0]).maybeSingle()
  if (!user) return NextResponse.json({ error: 'User not found by username' }, { status: 404 })

  // Find or create a default channel
  let channelId: string | null = null
  const { data: existingChannel } = await supabase.from('channels').select('id').eq('creator_id', user.id).maybeSingle()
  if (existingChannel) {
    channelId = existingChannel.id
  } else {
    const { data: newChannel } = await supabase.from('channels').insert({
      creator_id: user.id, name: 'My Channel', slug: `channel-${user.id.slice(0, 8)}`,
    }).select('id').single()
    if (newChannel) channelId = newChannel.id
  }

  if (!channelId) return NextResponse.json({ error: 'Could not create channel' }, { status: 500 })

  // Update all videos to this creator and channel
  const { data: updated, error } = await supabase
    .from('videos')
    .update({ creator_id: user.id, channel_id: channelId })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id, title')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reassigned: updated?.length || 0, videos: updated })
}
