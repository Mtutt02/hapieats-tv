/**
 * Simple in-memory rate limiter for payment routes.
 *
 * NOTE: This is a per-process store — it resets on cold starts and does not
 * share state across serverless instances.  It is effective as a first-line
 * defence against burst abuse from a single user.  For production hardening,
 * replace the store with an Upstash Redis or Vercel KV call.
 *
 * Usage:
 *   const result = checkRateLimit(userId, 'checkout', 5, 60_000)
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * @param key      Unique key for this limiter bucket (e.g. `${userId}:checkout`)
 * @param limit    Maximum requests allowed in the window
 * @param windowMs Sliding window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  entry.count += 1
  const resetAt = entry.windowStart + windowMs

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt }
  }

  return { allowed: true, remaining: limit - entry.count, resetAt }
}

// Periodically prune stale entries to avoid unbounded memory growth.
// Runs every 5 minutes, removes entries older than 10 minutes.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 10 * 60_000
    for (const [key, entry] of store) {
      if (entry.windowStart < cutoff) store.delete(key)
    }
  }, 5 * 60_000)
}
