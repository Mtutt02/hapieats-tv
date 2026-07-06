import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const CRON_SECRET      = process.env.CRON_SECRET
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAdminRole(userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

const ADMIN_ROLES = ['admin', 'moderator', 'superadmin']

// ── AI scan ────────────────────────────────────────────────────────────────

interface ContentItem {
  type: 'comment' | 'chat'
  id: string
  text: string
  author: string
  context: string
}

interface FlaggedItem {
  id: string
  type: string
  category: string
  severity: string
  snippet: string
  author: string
}

async function runAIScan(): Promise<{ scanned: number; flagged: number; categories: string[] }> {
  const service = createServiceClient()
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const [{ data: comments }, { data: chatMessages }] = await Promise.all([
    service
      .from('comments')
      .select(`id, body, created_at,
               author:profiles!comments_author_id_fkey(username),
               video:videos!comments_video_id_fkey(id, title)`)
      .gte('created_at', cutoff)
      .limit(100),
    service
      .from('live_chat_messages')
      .select(`id, message, type, created_at,
               sender:profiles!live_chat_messages_sender_id_fkey(username)`)
      .gte('created_at', cutoff)
      .eq('type', 'message')
      .limit(100),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allContent: ContentItem[] = [
    ...(comments ?? []).map((c: any) => ({
      type: 'comment' as const,
      id: c.id,
      text: c.body ?? '',
      author: c.author?.username ?? 'unknown',
      context: c.video?.title ?? 'unknown video',
    })),
    ...(chatMessages ?? []).map((m: any) => ({
      type: 'chat' as const,
      id: m.id,
      text: m.message ?? '',
      author: m.sender?.username ?? 'unknown',
      context: 'live chat',
    })),
  ].filter(item => item.text.trim().length > 0)

  if (allContent.length === 0) {
    return { scanned: 0, flagged: 0, categories: [] }
  }

  // ── Call Claude Haiku ──────────────────────────────────────────────────
  const prompt = `You are a content moderation AI for HapiEats TV, a cooking and food content platform.

Review the following user-generated content and identify violations of community guidelines.

Flag content that contains ANY of:
- hate speech, slurs, or discrimination
- harassment, bullying, or threats
- sexual content or explicit references
- spam, self-promotion, or phishing links
- violence or threats of harm
- doxxing or sharing personal information
- promotion of illegal activity

Content to review:
${JSON.stringify(allContent, null, 2)}

Respond ONLY with a valid JSON array. Include an item for each violation. If nothing violates guidelines, return [].

Each item must be:
{
  "id": "<content id from input>",
  "type": "<comment|chat>",
  "category": "<hate_speech|harassment|sexual|spam|violence|doxxing|illegal>",
  "severity": "<low|medium|high>",
  "snippet": "<first 150 chars of the problematic text>",
  "author": "<username from input>"
}`

  let flagged: FlaggedItem[] = []

  if (!ANTHROPIC_API_KEY) {
    console.warn('[ai-moderate] ANTHROPIC_API_KEY not set — skipping AI scan')
    return { scanned: allContent.length, flagged: 0, categories: [] }
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Anthropic API ${resp.status}: ${txt.slice(0, 200)}`)
  }

  const aiData = await resp.json()
  const rawText: string = aiData.content?.[0]?.text ?? '[]'

  // Safely extract the JSON array from the response
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      flagged = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[ai-moderate] Failed to parse AI response JSON:', rawText.slice(0, 500))
    }
  }

  // ── Insert content_reports ─────────────────────────────────────────────
  if (flagged.length > 0) {
    const reports = flagged.map(f => ({
      reason: `ai:${f.category}`,
      detail: `[AI ${f.severity}] @${f.author}: "${String(f.snippet ?? '').slice(0, 200)}"`,
      status: 'pending',
    }))

    const { error: insertErr } = await service.from('content_reports').insert(reports)
    if (insertErr) {
      console.error('[ai-moderate] Insert failed:', insertErr.message)
    }
  }

  return {
    scanned: allContent.length,
    flagged: flagged.length,
    categories: [...new Set(flagged.map(f => f.category))],
  }
}

// ── GET ────────────────────────────────────────────────────────────────────
// Vercel cron calls GET with Authorization: Bearer <CRON_SECRET>
// Admin users call GET to read recent AI reports

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const isCron = !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`)

  if (isCron) {
    // Cron-triggered scan
    try {
      const result = await runAIScan()
      return NextResponse.json({ ok: true, ...result })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ai-moderate] Cron scan error:', msg)
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // Manual admin read — return recent AI-flagged reports
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getAdminRole(user.id)
  if (!role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: reports } = await service
    .from('content_reports')
    .select('id, reason, detail, status, created_at')
    .like('reason', 'ai:%')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ reports: reports ?? [] })
}

// ── POST ───────────────────────────────────────────────────────────────────
// Manual scan trigger from admin/moderator UI

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getAdminRole(user.id)
  if (!role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await runAIScan()
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-moderate] Manual scan error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
