import { NextResponse } from 'next/server'

/**
 * Retired — duplicate of POST /api/live/gift.
 *
 * This route reimplemented the same gifting economics but took the
 * creator/platform/circle split from the global `platform_settings` row,
 * while /api/live/gift takes it per-gift from `live_gifts`. The same gift
 * therefore paid the creator a different amount depending on which endpoint
 * was used. Nothing in the web app or the mobile app called this one (the
 * mobile client posts to /api/live/gift), so it is disabled rather than left
 * reachable as a second, divergent way to move tokens.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Gone — use /api/live/gift' },
    { status: 410 },
  )
}
