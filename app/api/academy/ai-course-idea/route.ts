import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  COURSE_CATEGORIES,
  type AiCourseIdea,
  type CourseLevel,
} from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced', 'professional']

// ── Shape validation / coercion ──────────────────────────────────────────────

function coerceLevel(v: unknown): CourseLevel {
  return LEVELS.includes(v as CourseLevel) ? (v as CourseLevel) : 'beginner'
}

function coerceCategory(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase()
  return (COURSE_CATEGORIES as readonly string[]).includes(s) ? s : 'general'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateIdea(raw: any): AiCourseIdea | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return null

  const sections = raw.sections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((sec: any) => {
      if (!sec || typeof sec.title !== 'string' || !Array.isArray(sec.lessons)) return null
      const lessons = sec.lessons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((les: any) => {
          if (!les || typeof les.title !== 'string' || !les.title.trim()) return null
          return {
            title: String(les.title).trim(),
            summary: typeof les.summary === 'string' ? les.summary.trim() : '',
            hasRecipe: Boolean(les.hasRecipe),
          }
        })
        .filter(Boolean) as AiCourseIdea['sections'][number]['lessons']
      if (lessons.length === 0) return null
      return { title: String(sec.title).trim(), lessons }
    })
    .filter(Boolean) as AiCourseIdea['sections']

  if (sections.length === 0) return null

  const est = Number(raw.estimatedMinutes)
  return {
    title: String(raw.title).trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    category: coerceCategory(raw.category),
    level: coerceLevel(raw.level),
    estimatedMinutes: Number.isFinite(est) && est > 0 ? Math.round(est) : 90,
    sections,
  }
}

// ── Fallback idea (never 500 the UX) ─────────────────────────────────────────

function fallbackIdea(level: CourseLevel, note?: string): AiCourseIdea & { note?: string } {
  return {
    title: 'Weeknight Mastery: 30-Minute Dinners That Never Repeat',
    description:
      'A practical, high-energy course that turns pantry staples into crave-worthy dinners on a weeknight timeline. Learn the core techniques that unlock endless variations, then build a personal rotation you actually look forward to cooking.',
    category: 'general',
    level,
    estimatedMinutes: 120,
    sections: [
      {
        title: 'Foundations of Fast Cooking',
        lessons: [
          { title: 'The 30-Minute Mindset & Mise en Place', summary: 'Set up your station so cooking flows without panic.', hasRecipe: false },
          { title: 'Heat, Salt, Fat, Acid — Your Four Dials', summary: 'The levers that make any dish taste balanced.', hasRecipe: false },
        ],
      },
      {
        title: 'Building Blocks',
        lessons: [
          { title: 'One-Pan Roasted Chicken & Veg', summary: 'A sheet-pan template you can reskin infinitely.', hasRecipe: true },
          { title: 'The Perfect Weeknight Pasta', summary: 'Emulsified sauces from starchy water and pantry basics.', hasRecipe: true },
          { title: 'Stir-Fry Without a Recipe', summary: 'Ratios and sequencing for a fast, glossy stir-fry.', hasRecipe: true },
        ],
      },
      {
        title: 'Make It Yours',
        lessons: [
          { title: 'Flavor Swaps & Global Riffs', summary: 'Turn one base dish into five cuisines.', hasRecipe: false },
          { title: 'Building Your Weekly Rotation', summary: 'Plan a repeatable menu you never get bored of.', hasRecipe: false },
        ],
      },
    ],
    ...(note ? { note } : {}),
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const level = coerceLevel(body.level)
  const category = body.category ? coerceCategory(body.category) : ''

  // No API key → curated static example with a note (never 500 the UX)
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      idea: fallbackIdea(level, 'AI is not configured — showing a curated example idea.'),
    })
  }

  const prompt = `You are a curriculum designer for HapiEats Academy, a premium online cooking school.

Design ONE cohesive, marketable cooking course outline.

${topic ? `Requested topic: "${topic}"` : 'No topic was given — invent a strong, marketable course idea a home cook would eagerly enroll in.'}
Target level: ${level}
${category ? `Preferred category: ${category}` : ''}

Requirements:
- Pick a category from EXACTLY this list: ${COURSE_CATEGORIES.join(', ')}.
- Give it a punchy, benefit-driven title and a compelling 1-2 sentence description.
- estimatedMinutes = a realistic total runtime for all lessons combined.
- 3 to 5 sections. Each section has 2 to 4 lessons.
- Each lesson has a short title, a one-sentence summary, and hasRecipe (true only when the lesson centers on cooking a specific dish).

Respond with ONLY valid JSON, no prose, no code fences, matching EXACTLY this shape:
{
  "title": "string",
  "description": "string",
  "category": "one of the allowed categories",
  "level": "${level}",
  "estimatedMinutes": 90,
  "sections": [
    { "title": "string", "lessons": [ { "title": "string", "summary": "string", "hasRecipe": false } ] }
  ]
}`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) {
      console.error('[ai-course-idea] Anthropic API', resp.status)
      return NextResponse.json({ idea: fallbackIdea(level, 'AI request failed — showing a curated example idea.') })
    }

    const aiData = await resp.json()
    let rawText: string = aiData.content?.[0]?.text ?? ''

    // Strip code fences if the model wrapped the JSON
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()

    // Extract the outermost JSON object
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ idea: fallbackIdea(level, 'Could not read AI output — showing a curated example idea.') })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ idea: fallbackIdea(level, 'Could not parse AI output — showing a curated example idea.') })
    }

    const idea = validateIdea(parsed)
    if (!idea) {
      return NextResponse.json({ idea: fallbackIdea(level, 'AI output was malformed — showing a curated example idea.') })
    }
    // Honor the requested level even if the model drifted.
    idea.level = level

    return NextResponse.json({ idea })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-course-idea] error:', msg)
    return NextResponse.json({ idea: fallbackIdea(level, 'Something went wrong — showing a curated example idea.') })
  }
}
