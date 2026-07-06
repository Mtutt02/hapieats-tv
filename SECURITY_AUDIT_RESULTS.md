# HapiEats TV — Security Audit Results

**Audit date:** 2026-07-01
**Auditor:** Claude (automated + manual review)

---

## What Was Checked

### API Routes (54 route files total)
- `app/api/admin/**` — 9 routes
- `app/api/live/**` — gift route
- `app/api/tokens/**` — purchase, balance
- `app/api/flavor/**` — wallet, gift, purchase, cashout
- `app/api/mux/**` — upload, webhook, import
- `app/api/stripe/**` — checkout, webhook, connect (onboard, portal, status)
- `app/api/videos/**` — comments, like, status
- `app/api/channels/**` — create, update
- `app/api/users/**`, `app/api/user/**` — profile, privacy, password, delete-account
- `app/api/classes/**` — CRUD, enroll, lesson, checkout
- `app/api/livestreams/**` — create, status, [id]
- `app/api/stations/**` — follow
- `app/api/reports/**`, `app/api/search/**`, `app/api/creator/**`

### Auth Infrastructure
- `lib/supabase/server.ts` — createClient / createServiceClient
- `lib/supabase/middleware.ts` — session refresh + route protection
- `middleware.ts` — matcher config

### Webhooks
- `app/api/stripe/webhook/route.ts`
- `app/api/mux/webhook/route.ts`

### Database Migrations (13 files)
- `supabase/migrations/001_initial.sql` through `20260701_security_hardening.sql`

---

## What Was Already Good

### Authentication Pattern
- Every protected route uses `supabase.auth.getUser()` (server-verified JWT), **never** `getSession()` (client-unverified). This is correct.
- The `createServiceClient()` (service-role key) is reserved for privileged writes and webhook handlers — never used for auth decisions.
- 401 is returned before 403 in all routes (correct order: "are you logged in?" before "are you allowed?").

### Admin Role Guards
- All admin routes use a `requireAdmin()` / `requireSuperAdmin()` helper that reads the role from the DB server-side.
- Superadmin-only actions (promote, demote, delete, set_role) are correctly guarded at the action level even if the route already requires admin.
- Moderators cannot touch billing columns — the `20260701_security_hardening.sql` migration revokes `UPDATE` on sensitive columns from the `authenticated` role at the database level.

### Stripe Webhook Handler
- `stripe.webhooks.constructEvent()` signature verification is implemented and rejects all requests if `STRIPE_WEBHOOK_SECRET` is missing or malformed.
- Handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- All token/flavor credit operations use idempotent upsert patterns.
- Platform subscription status updated both via `checkout.session.completed` and `customer.subscription.*` events.

### Mux Webhook Handler
- `mux.webhooks.verifySignature()` is called and rejects requests if `MUX_WEBHOOK_SECRET` is missing.
- Handles `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`, `video.asset.deleted`, `video.live_stream.active`, `video.live_stream.idle`, `video.asset.live_stream_completed`.
- The webhook uses `createServiceClient()` to write DB updates (bypasses user-level RLS correctly).

### IDOR Prevention
- `live/gift` and `flavor/gift` look up `creator_id` server-side from the stream record — never trust the client-supplied value.
- `livestreams/create` verifies channel ownership via `eq('creator_id', user.id)`.
- `mux/upload` and `mux/import` both verify channel ownership before inserting video records.
- `classes/[classId]/enroll/checkout` fetches price from DB — never from the client body.
- `stripe/checkout` fetches `stripe_price_id` and video `price` from DB for pay-per-view and creator subscription modes.

### Open Redirect Protection
- `stripe/checkout` and `flavor/purchase` both implement `safeRedirectUrl()` that enforces same-origin redirect URLs.

### RLS Coverage
All audited tables have RLS enabled:
- `profiles` ✓ — public select, owner update; sensitive columns revoked from anon/authenticated
- `channels` ✓ — public select, creator manages own
- `videos` ✓ — public select (ready+public only), creator manages own
- `live_streams` ✓ — public select, `stream_key` column revoked from anon/authenticated
- `subscriptions` ✓ — user reads own, service role manages
- `purchases` ✓ — user reads own, service role manages
- `token_balances` ✓ — user reads own, service role manages
- `flavor_wallets` ✓ — user reads own, service role manages
- `flavor_purchases` ✓ — user reads own
- `flavor_gift_events` ✓ — sender/creator read
- `creator_flavor_earnings` ✓ — creator reads own
- `flavor_cashout_requests` ✓ — creator reads own
- `content_reports` ✓ — authenticated insert, service role manages

### Disabled/Stub Routes
- `app/api/seed/route.ts` — returns 404
- `app/api/debug-auth/route.ts` — returns 404
- `app/api/admin/grant-superadmin/route.ts` — returns 404
- `app/api/admin/bootstrap/route.ts` — returns 410 Gone
- `app/api/admin/seed-real-videos/route.ts` — returns 404
- `app/api/admin/sync-mux-videos/route.ts` — returns 404

---

## What Was Fixed

### 1. Optimistic Lock Race Condition — Gift Routes (HIGH)

**Files fixed:**
- `app/api/live/gift/route.ts`
- `app/api/flavor/gift/route.ts`

**Problem:** Both gift routes implemented an optimistic lock by matching `balance = currentBalance` on the update. However, the Supabase JS v2 `.update()` does not return `count` without an explicit `.select()`. The code checked `count === 0` (live/gift) or just `deductError` (flavor/gift), but `count` was always `null`, meaning the balance check was silently skipped — a race condition could allow double-spending tokens.

**Fix:** Added `.select('balance')` to both update calls so the result array is returned. If `deductResult.length === 0` (0 rows updated because balance changed), a 409 is returned.

---

### 2. Open Redirect on Class Enrollment Checkout (MEDIUM)

**File fixed:** `app/api/classes/[classId]/enroll/checkout/route.ts`

**Problem:** `successUrl` and `cancelUrl` from the request body were passed directly to Stripe without origin validation. An attacker could craft a checkout URL that redirects to a phishing site after payment.

**Fix:** Added the same `safeRedirectUrl()` function used in `stripe/checkout` and `flavor/purchase` — validates that the URL origin matches `NEXT_PUBLIC_APP_URL` before using it; falls back to a safe default otherwise.

---

### 3. Rate Limiting Missing on Payment Initiation Routes (MEDIUM)

**Files fixed:**
- `app/api/stripe/checkout/route.ts`
- `app/api/tokens/purchase/route.ts`
- `app/api/flavor/purchase/route.ts`
- `app/api/classes/[classId]/enroll/checkout/route.ts`

**New file created:** `lib/rate-limit.ts`

**Problem:** No rate limiting on any payment route — a single user (or compromised account) could spin up thousands of Stripe checkout sessions in a tight loop, potentially generating fraudulent charges or exhausting Stripe API rate limits.

**Fix:** Created `lib/rate-limit.ts` — a lightweight in-memory sliding-window rate limiter. All four payment routes now enforce 10 sessions per user per 10 minutes, returning HTTP 429 on excess. Includes a periodic cleanup of stale entries.

**Note:** The in-memory store resets on cold starts and does not share across serverless instances. For production scale, replace the `Map` store in `lib/rate-limit.ts` with Upstash Redis or Vercel KV.

---

### 4. `/api/tokens/balance` Returns 200 for Unauthenticated Users (LOW)

**File fixed:** `app/api/tokens/balance/route.ts`

**Problem:** Unauthenticated requests got `{ balance: 0 }` with HTTP 200 instead of a 401. While no data was leaked, this masked auth failures silently and was inconsistent with every other protected route.

**Fix:** Changed to return `{ error: 'Unauthorized' }` with HTTP 401.

---

### 5. No Input Validation on `/api/user/profile` Username/DisplayName (LOW)

**File fixed:** `app/api/user/profile/route.ts`

**Problem:** `username` and `displayName` fields were accepted without length or format validation. A user could set a zero-length username, a 100,000-character display name, or a username containing special characters that could break UI rendering or slug generation.

**Fix:** Added validation:
- `displayName`: 2–80 characters (trimmed)
- `username`: 3–30 characters, alphanumeric + underscore only (`/^[a-zA-Z0-9_]{3,30}$/`)
- `bio`: max 500 characters (previously only validated in `profile/update`, not in `user/profile`)

Also added missing redirect URL origin check to `tokens/purchase` (was missing `safeRedirectUrl` while the other purchase routes had it).

---

## Remaining Risks (Medium / Low)

| Risk | Severity | Notes |
|------|----------|-------|
| Rate limiter is in-memory | Medium | Effective against single-instance burst abuse; not shared across serverless instances. Upgrade to Upstash Redis for production. |
| `app/api/admin/setup` still active | Low-Medium | Protected by `ADMIN_SETUP_SECRET` env var check. Should be removed or moved behind an IP allowlist after initial setup. |
| `app/api/search` ILIKE pattern | Low | User-controlled string passed to `.ilike.%string%` — Supabase parameterizes the query so SQL injection is not possible, but extremely long search strings could cause slow DB scans. Add a `q.length <= 100` guard. |
| `comments` table has no RLS INSERT restriction | Low | Any authenticated user can insert a comment on any video. This is likely intentional, but flagged for awareness. The `is_flagged` column is in place for moderation. |
| No CAPTCHA on account creation | Low | Standard for platforms of this size; consider adding if bot signups become an issue. |
| `exec_sql` RPC function removed by migration | Resolved | The `20260701_security_hardening.sql` migration drops `public.exec_sql` which was a one-time setup helper but would have been an arbitrary SQL execution backdoor in production. Confirmed removed. |
