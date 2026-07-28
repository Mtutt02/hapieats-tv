import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** GET /api/editor/projects — list the caller's cloud-synced studio projects */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
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

  const service = createServiceClient()
  const { error } = await service
    .from('editor_projects')
    .upsert({
      id: project.id,
      user_id: user.id,
      title: project.title.slice(0, 200),
      data: project,
      updated_at: new Date().toISOString(),
    })

  if (error) {
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

  const service = createServiceClient()
  await service.from('editor_projects').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
