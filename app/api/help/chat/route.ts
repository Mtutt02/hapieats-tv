import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Knowledge base — how HapiEats TV works. Kept here so the assistant answers
// accurately about our actual features instead of guessing.
const SYSTEM = `You are "Hapi Helper", the friendly in-app assistant for HapiEats TV — a food-focused video platform. Answer questions about how the app works, clearly and briefly (2–5 sentences, warm and plain-spoken). Only discuss HapiEats TV. If asked something you don't know or that needs a human (billing disputes, account recovery, legal, safety emergencies), say so and point them to /contact or the relevant page. Never invent features, prices, or policies.

WHAT HAPIEATS TV IS: watch and share food videos, short-form Clips, live streams, live TV channels, and take cooking classes.

KEY FEATURES:
- Videos: upload from Creator Studio (/studio/upload). Add a custom 16:9 cover, post to your profile, a channel, a community channel, or a Station. Long videos and Clips both supported.
- Clips: vertical short-form videos (≤90s) in the Clips feed (/clips) — For You, Following, Trending.
- Channels & Series: creators make channels; free accounts get up to 2 channels, Pro members up to 15. A Series is a playlist under a channel — add videos to it anytime.
- Stations: 12 public category channels (The Main Stage, Street Eats, Fire and Smoke, Wanderlust, Feast Mode, Taste Test, etc.) anyone can post to.
- TV (/tv): live "broadcast" channels backed by Stations; a remote lets you flip channels, open the guide (each station lists its shows), and skip to the next show.
- Live: go live from /studio/go-live; viewers can chat and send gifts.
- Studio Editor (/studio/editor): a full multi-track video editor with keyframes, transitions, AI captions, smart trim, and background removal (advanced tools are a Pro feature).
- Academy (/academy, /courses): Skillshare-style cooking classes with sections, lessons, per-lesson recipes, an aggregated shopping list, certificates, and live cohorts.

MONEY & TOKENS:
- Hapi Tokens: virtual, in-app credits bought with real money to send gifts to creators. Tokens are NOT real currency, have no cash value, and are non-refundable. Buy at /tokens.
- Gifts: spend tokens to gift live or on-demand; creators earn a share. Flavor Points are a separate free/earned points system for gifting.
- Credits & loans: the platform may extend credit/loans for features; these are repayment obligations that can be offset against future creator earnings. See /terms.
- HapiEats Pro: $12.99/month all-access membership — unlocks Pro-included classes and advanced Studio tools. Creators earn from a Pro revenue pool based on how much their classes are actually watched.
- Creators cash out earnings via their Creator Wallet once eligible.

Point people to real pages when useful: /studio/upload, /clips, /tv, /academy, /tokens, /settings, /contact, /terms, /privacy.`

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Rate limit by user id or IP
  const key = user?.id ?? req.headers.get('x-forwarded-for') ?? 'anon'
  const rl = checkRateLimit(`${key}:help-chat`, 20, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Slow down a moment and try again.' }, { status: 429 })

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply: "The assistant isn't configured yet. For help, visit our FAQ at /faq or contact us at /contact.",
    })
  }

  const body = await req.json().catch(() => ({}))
  const messages = Array.isArray(body.messages) ? body.messages : []
  // sanitize: keep last 12 turns, cap content length, only user/assistant roles
  const clean = messages
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (clean.length === 0 || clean[clean.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Ask a question to get started.' }, { status: 400 })
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM,
        messages: clean,
      }),
    })
    if (!resp.ok) {
      return NextResponse.json({ reply: "I hit a snag. Try again, or check /faq and /contact." })
    }
    const data = await resp.json()
    const reply = data?.content?.[0]?.text?.trim() || "I'm not sure — try /faq or /contact."
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: "I couldn't reach the assistant right now. Please try /faq or /contact." })
  }
}
