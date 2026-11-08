import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** GET /api/editor/projects — list the caller's cloud-synced studio projects */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Session client, not service role: RLS (editor_projects_own) enforces ownership in the database.
  const { data, error } = await supabase
    .from('editor_projects')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    // table may not exist yet — degrade gracefully, local persistence still works
    return NextResponse.json({ projects: [] })
  }
  return NextResponse.json({ projects: data ?? [] })
}

/** POST /api/editor/projects — upsert a project JSON snapshot */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const project = body?.project
  if (!project?.id || typeof project.id !== 'string' || typeof project.title !== 'string') {
    return NextResponse.json({ error: 'Invalid project payload' }, { status: 400 })
  }
  const raw = JSON.stringify(project)
  if (raw.length > 2_000_000) {
    return NextResponse.json({ error: 'Project too large to sync' }, { status: 413 })
  }

  // Runs as the caller (session client), so RLS also blocks cross-account writes; the
  // user_id filters below are defense in depth.
  // 1) Update only a row this user owns. 2) Otherwise insert; the primary key
  // rejects an id that belongs to another account (23505), so no one can
  // overwrite or reassign someone else's project by guessing its id.
  const title = project.title.slice(0, 200)
  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('editor_projects')
    .update({ title, data: project, updated_at: now })
    .eq('id', project.id)
    .eq('user_id', user.id)
    .select('id')

  if (updateError) {
    return NextResponse.json({ error: 'Cloud sync unavailable' }, { status: 503 })
  }
  if (updated && updated.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const { error: insertError } = await supabase
    .from('editor_projects')
    .insert({ id: project.id, user_id: user.id, title, data: project, updated_at: now })

  if (insertError?.code === '23505') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (insertError) {
    return NextResponse.json({ error: 'Cloud sync unavailable' }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}

/** DELETE /api/editor/projects?id=... */
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await supabase.from('editor_projects').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
