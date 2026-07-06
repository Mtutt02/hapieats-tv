import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, description, subscription_price } = body

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return NextResponse.json(
        { error: 'Channel name must be between 2 and 80 characters' },
        { status: 400 }
      )
    }

    // Validate slug
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const trimmedSlug = slug.trim()
    if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      return NextResponse.json(
        { error: 'Slug must be between 3 and 50 characters' },
        { status: 400 }
      )
    }

    if (!SLUG_RE.test(trimmedSlug)) {
      return NextResponse.json(
        { error: 'Slug may only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    // Validate subscription_price if provided
    if (subscription_price !== undefined && subscription_price !== null && subscription_price !== '') {
      const price = Number(subscription_price)
      if (isNaN(price) || price < 0.99) {
        return NextResponse.json(
          { error: 'Subscription price must be at least $0.99' },
          { status: 400 }
        )
      }
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('slug', trimmedSlug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This slug is already taken. Please choose another.' },
        { status: 409 }
      )
    }

    // Insert channel
    const { data: channel, error: insertError } = await supabase
      .from('channels')
      .insert({
        creator_id: user.id,
        name: name.trim(),
        slug: trimmedSlug,
        description: description?.trim() || null,
        subscription_price:
          subscription_price !== undefined && subscription_price !== null && subscription_price !== ''
            ? Number(subscription_price)
            : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Channel insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
    }

    // Update profile to mark user as creator
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_creator: true })
      .eq('id', user.id)

    if (profileError) {
      // Non-fatal — channel was created, log and continue
      console.error('Profile update error:', profileError)
    }

    return NextResponse.json({ channel }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in /api/channels/create:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
