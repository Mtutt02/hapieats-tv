# HapiEats TV — Full Application Audit Plan
**Date:** June 2026  
**Stack:** Next.js 14.2.5 App Router · Supabase (Auth + Postgres + RLS) · Mux (Video/Live) · Stripe (Payments) · Vercel (Hosting)

---

## HOW TO USE THIS DOCUMENT

Each section lists items to check. Mark each item:
- ✅ **Pass** — working as expected
- ⚠️ **Issue** — needs attention (note severity: Low / Medium / High / Critical)
- ❌ **Fail** — broken or missing
- 🔲 **Not tested** — pending review

---

## SECTION 1 — AUTHENTICATION & SESSION MANAGEMENT

### 1.1 Registration Flow (`/register`)
- [ ] User can register with email + password
- [ ] Email confirmation email is sent (Supabase triggers)
- [ ] Confirmation link redirects to `https://hapieats-tv.vercel.app` (not localhost)
- [ ] After confirming, user is logged in and redirected to `/`
- [ ] Duplicate email shows a clear error message
- [ ] Weak passwords are rejected (Supabase min-length policy)
- [ ] Profile row is auto-created in `profiles` table on sign-up (Supabase trigger or hook)

### 1.2 Login Flow (`/login`)
- [ ] Email + password login works
- [ ] Google OAuth login works (redirects correctly)
- [ ] Invalid credentials show error, do not reveal which field is wrong
- [ ] `?redirect=` param works — redirects user after login
- [ ] **⚠️ SECURITY:** `redirect` param is NOT validated against a whitelist — test `/login?redirect=https://evil.com` for open redirect

### 1.3 Session & Cookies
- [ ] Session cookie is `httpOnly`, `Secure`, `SameSite=Lax`
- [ ] Middleware (`middleware.ts`) correctly refreshes Supabase session on every request
- [ ] Session expires and forces re-login after Supabase token TTL
- [ ] Logging out clears session cookie and redirects to `/`

### 1.4 OAuth Callback (`/auth/callback`)
- [ ] Google OAuth callback page exists and handles the code exchange
- [ ] `?redirect=` is passed through OAuth flow and used after callback
- [ ] Failed OAuth shows a friendly error

### 1.5 Password Reset
- [ ] Forgot password flow exists (check if Supabase email template is configured)
- [ ] **⚠️ MISSING:** No "forgot password" link visible on `/login` page
- [ ] Password reset email redirects to production domain, not localhost

---

## SECTION 2 — ROUTE PROTECTION & AUTHORIZATION

### 2.1 Middleware (Edge)
Middleware in `middleware.ts` checks `/studio/*` and `/dashboard/*` and redirects unauthenticated users to `/login`.

- [ ] `/studio/upload` — redirects to login when not authenticated
- [ ] `/studio/videos` — redirects to login when not authenticated
- [ ] `/studio/channel/new` — redirects to login when not authenticated
- [ ] `/studio/classes` — redirects to login when not authenticated
- [ ] `/studio/go-live` — redirects to login when not authenticated
- [ ] `/dashboard` — redirects to login when not authenticated
- [ ] `/dashboard/settings` — redirects to login when not authenticated
- [ ] **⚠️ GAP:** Middleware does NOT protect API routes — each API route does its own auth check (verify consistency below)

### 2.2 API Route Auth — Server-Side Checks
Each API route should independently verify the session.

| Endpoint | Method | Auth Required | Status to Check |
|---|---|---|---|
| `/api/mux/upload` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/mux/webhook` | POST | Mux signature | Returns 401 on bad sig |
| `/api/stripe/checkout` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/stripe/webhook` | POST | Stripe signature | Returns 400 on bad sig |
| `/api/channels/create` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/channels/update` | PATCH | ✅ Yes | Returns 401 if not logged in |
| `/api/profile/update` | PATCH | ✅ Yes | Returns 401 if not logged in |
| `/api/livestreams/create` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/livestreams/[id]` | GET | ❌ No | Public — stream key exposure risk |
| `/api/livestreams/status` | GET | Need to verify | Check manually |
| `/api/videos/[videoId]/comments` | GET | ❌ No | Public — correct |
| `/api/videos/[videoId]/comments` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/videos/[videoId]/comments` | DELETE | ✅ Yes | Returns 403 if not owner |
| `/api/videos/[videoId]/like` | POST/DELETE | ✅ Yes | Returns 401 if not logged in |
| `/api/search` | GET | ❌ No | Public — correct |
| `/api/classes` | GET | ❌ No | Public — correct |
| `/api/classes` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/classes/[classId]` | GET | Need to verify | Check manually |
| `/api/classes/[classId]/enroll` | POST | ✅ Yes | Returns 401 if not logged in |
| `/api/classes/[classId]/lessons` | GET/POST | Need to verify | Check manually |

### 2.3 Ownership Verification
- [ ] Upload: channel ownership checked before creating Mux upload
- [ ] Live stream creation: channel ownership checked before creating Mux stream
- [ ] Class creation: channel ownership checked before insert
- [ ] Comment delete: author_id verified before deletion
- [ ] Channel update: `creator_id` tied to authenticated user

### 2.4 Supabase Row Level Security (RLS)
- [ ] RLS is enabled on `videos` table
- [ ] RLS is enabled on `channels` table
- [ ] RLS is enabled on `profiles` table
- [ ] RLS is enabled on `live_streams` table (stream_key must be hidden from non-owners)
- [ ] RLS is enabled on `comments` table
- [ ] RLS is enabled on `purchases` table
- [ ] RLS is enabled on `subscriptions` table
- [ ] RLS is enabled on `video_likes` table
- [ ] RLS is enabled on `classes` table
- [ ] RLS is enabled on `class_enrollments` table
- [ ] **⚠️ CRITICAL:** Verify that `stream_key` in `live_streams` is NOT readable by users other than the creator — if RLS is missing or uses `anon` key, any user could query stream keys

---

## SECTION 3 — USER FLOWS

### 3.1 Home Page (`/`)
- [ ] Page loads and shows category pill bar
- [ ] Stations carousel shows when "All" category selected
- [ ] Sample content shows when no real videos in DB
- [ ] "Sample content" notice banner appears with link to `/studio/upload`
- [ ] Real videos show when DB has content
- [ ] Category filter buttons filter the video grid
- [ ] Video cards show title, creator, view count, duration

### 3.2 Video Playback (`/watch/[videoId]`)
- [ ] Free public videos play without login
- [ ] Mux player loads and plays correctly
- [ ] Pay-per-view videos prompt purchase for non-buyers
- [ ] Subscriber-only videos prompt subscription for non-subscribers
- [ ] Like button works (requires login)
- [ ] Comments load on page
- [ ] Posting a comment requires login
- [ ] Comment character limit enforced (1–2000 chars)
- [ ] User can delete their own comments
- [ ] View count increments on watch (verify mechanism)

### 3.3 Search (`/search`)
- [ ] Search results load for query
- [ ] Query under 2 characters shows error
- [ ] Videos and channels both appear in results
- [ ] Results link to correct pages

### 3.4 Channel Page (`/channel/[username]`)
- [ ] Channel info displays (name, description, subscriber count)
- [ ] Video grid shows channel's published videos
- [ ] Subscribe button appears (needs implementation check)
- [ ] Correct 404 handling for non-existent channels

### 3.5 Stations (`/stations`, `/stations/[slug]`)
- [ ] Stations browse page shows all 8 sample stations
- [ ] Station cards link to correct `/stations/[slug]`
- [ ] Station detail page shows banner, name, follower count
- [ ] Follow and Upload buttons render
- [ ] Video grid shows station-filtered content
- [ ] "Create a Station" CTA card visible
- [ ] **⚠️ NOT IMPLEMENTED:** Stations are sample-data only — no DB table exists, no real follow/upload-to-station functionality

### 3.6 Classes (`/classes`, `/classes/[classId]`)
- [ ] Classes list loads from DB (published only)
- [ ] Filter by type (live/recorded/series) works
- [ ] Class detail page shows title, instructor, price
- [ ] Free class enrollment works without payment
- [ ] Paid class enrollment redirects to Stripe checkout
- [ ] Already-enrolled users see enrolled state
- [ ] Full class shows "class is full" message

### 3.7 Live Stream (`/live/[streamId]`)
- [ ] Mux live player loads for active streams
- [ ] Shows "stream offline" state for idle streams
- [ ] Live chat visible (check if WebSocket/Supabase realtime is connected)

### 3.8 Notifications (Bell icon in TopBar)
- [ ] Bell icon is present in UI
- [ ] **⚠️ NOT IMPLEMENTED:** No notification backend exists — bell is decorative only

---

## SECTION 4 — CREATOR FLOWS

### 4.1 Channel Creation (`/studio/channel/new`)
- [ ] Creator can create a channel with name, slug, description
- [ ] Slug validated: lowercase, alphanumeric + hyphens, 3–50 chars
- [ ] Duplicate slug returns clear error (409 Conflict)
- [ ] Optional subscription price validated (min $0.99)
- [ ] `profiles.is_creator` is set to `true` after channel creation
- [ ] User without a channel is redirected from `/studio/upload` to create one first

### 4.2 Video Upload (`/studio/upload`)
- [ ] Upload form shows channel selection
- [ ] Title, description, visibility, pricing model fields work
- [ ] Mux direct upload URL is generated correctly
- [ ] File upload progress shown (UploadStudio component)
- [ ] After upload, user sees processing state
- [ ] Mux webhook fires → `status` changes from `uploading` → `processing` → `ready`
- [ ] **⚠️ NOT LIVE:** Mux credentials are placeholder — actual upload will fail until real keys set

### 4.3 Video Management (`/studio/videos`)
- [ ] Creator sees only their own videos
- [ ] Can edit title, description, visibility
- [ ] Can delete a video
- [ ] Status column shows uploading / processing / ready / errored

### 4.4 Go Live (`/studio/go-live`)
- [ ] Creator can create a live stream
- [ ] Stream key is displayed after creation
- [ ] RTMP URL provided for OBS/streaming software
- [ ] Stream transitions to active when Mux detects signal
- [ ] **⚠️ NOT LIVE:** Mux credentials are placeholder

### 4.5 Classes Management (`/studio/classes`, `/studio/classes/new`)
- [ ] Creator can create a new class with title, description, type, skill level, price
- [ ] Class is created as `is_published: false` (draft)
- [ ] Creator can publish/unpublish classes
- [ ] Class with `max_students` enforces enrollment cap

### 4.6 Creator Dashboard (`/dashboard`)
- [ ] Shows total views, revenue, subscriber count, video count
- [ ] Video table lists all creator's videos with stats
- [ ] "Upload Video" CTA works

### 4.7 Dashboard Settings (`/dashboard/settings`)
- [ ] Display name update works (2–80 chars)
- [ ] Bio update works (max 300 chars)
- [ ] Avatar URL update works
- [ ] Channel name update works
- [ ] Channel description update works
- [ ] Subscription price change creates new Stripe Price object

---

## SECTION 5 — PAYMENTS & BILLING

### 5.1 Stripe Integration
- [ ] **⚠️ NOT LIVE:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are placeholder values
- [ ] Stripe is loaded correctly in production (check no test keys in prod)

### 5.2 Pay-Per-View Checkout
- [ ] `POST /api/stripe/checkout` with `mode: 'pay_per_view'` creates session
- [ ] **⚠️ SECURITY:** `priceInCents` is taken from the request body — client can manipulate the price. Should be fetched server-side from `videos.price` in DB
- [ ] On success, `purchases` table is upserted via Stripe webhook
- [ ] User can access purchased video after payment

### 5.3 Creator Channel Subscription
- [ ] `mode: 'creator_subscription'` creates a Stripe subscription
- [ ] `stripePriceId` is required — verify it comes from the channel's `stripe_price_id`
- [ ] Subscription status synced via webhook (`customer.subscription.created/updated/deleted`)
- [ ] Canceled subscriptions properly revoke access

### 5.4 Platform Subscription
- [ ] `mode: 'platform_subscription'` uses `NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID`
- [ ] Platform subscription status stored on `profiles` table
- [ ] `invoice.payment_failed` event sets status to `past_due`

### 5.5 Stripe Webhook Security
- [ ] `stripe.webhooks.constructEvent` verifies signature before processing
- [ ] Returns 400 on invalid signature
- [ ] Webhook endpoint excluded from middleware processing

### 5.6 Stripe Customer Management
- [ ] Stripe customer is created once per user and stored as `profiles.stripe_customer_id`
- [ ] Existing customers are reused, not duplicated

---

## SECTION 6 — SECURITY AUDIT

### 6.1 Input Validation
- [ ] Comment body: 1–2000 chars enforced server-side ✅
- [ ] Channel name: 2–80 chars enforced ✅
- [ ] Channel slug: regex enforced ✅
- [ ] Display name: 2–80 chars enforced ✅
- [ ] Bio: max 300 chars enforced ✅
- [ ] Search query: min 2 chars enforced ✅
- [ ] **⚠️ ISSUE:** `avatar_url` in profile update accepts any string — no URL format validation, no domain allowlist
- [ ] **⚠️ ISSUE:** Class `thumbnail_url` field accepts any string — no validation

### 6.2 Injection & XSS
- [ ] Supabase client uses parameterized queries — SQL injection risk is low
- [ ] Search uses `.ilike.%${trimmed}%` — input is parameterized by Supabase, but test with `' OR 1=1--` style payloads
- [ ] Comments are rendered as text — verify no raw HTML rendering in comment display component
- [ ] **⚠️ ISSUE:** No explicit HTML sanitization on comment body — check React component for `dangerouslySetInnerHTML`

### 6.3 Open Redirect
- [ ] **⚠️ HIGH:** `/login?redirect=https://evil.com` — the redirect param is used directly in `router.push(redirect)` without validation. An attacker can phish users by sending them to `/login?redirect=https://phishing-site.com`
- **Fix:** Validate that `redirect` starts with `/` (relative path only) before use

### 6.4 Rate Limiting
- [ ] **⚠️ MISSING:** No rate limiting on any API route — comment posting, liking, search, checkout all unprotected
- [ ] Recommend: Vercel Edge middleware rate limiting, or Upstash Redis rate limiter

### 6.5 Webhook Security
- [ ] Mux webhook: `mux.webhooks.verifySignature` called before processing ✅
- [ ] Stripe webhook: `stripe.webhooks.constructEvent` called before processing ✅
- [ ] Both webhooks use `runtime = 'nodejs'` for raw body parsing ✅
- [ ] Both webhook endpoints are excluded from middleware auth redirect ✅

### 6.6 Secrets & Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — confirm is correct production URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — confirm is production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — never exposed to client
- [ ] `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` — placeholder, set real values
- [ ] `MUX_WEBHOOK_SECRET` — placeholder, set real value
- [ ] `STRIPE_SECRET_KEY` — placeholder, set real value
- [ ] `STRIPE_WEBHOOK_SECRET` — placeholder, set real value
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — placeholder
- [ ] `NEXT_PUBLIC_APP_URL` — set to `https://hapieats-tv.vercel.app` ✅ (fixed earlier)
- [ ] None of the above `NEXT_PUBLIC_` prefixed secrets are actually private-only (by design) — verify no secret keys are accidentally prefixed with `NEXT_PUBLIC_`

### 6.7 CORS & Headers
- [ ] API routes do not set explicit CORS headers — by default restricted to same-origin
- [ ] Verify Vercel does not serve API routes with permissive CORS headers
- [ ] Check `next.config.js` for any `headers()` configuration

### 6.8 Stream Key Exposure
- [ ] `stream_key` field is stored in `live_streams` table
- [ ] `GET /api/livestreams/[id]` returns the full `liveStream` object including all fields
- [ ] **⚠️ CRITICAL:** Verify that `stream_key` is excluded from this GET response, or that RLS prevents non-owners from reading it — exposing a stream key lets anyone hijack the creator's stream

---

## SECTION 7 — ADMIN & MODERATION

### 7.1 Admin Panel
- [ ] **❌ MISSING:** No admin panel exists anywhere in the app
- [ ] No admin role defined in `profiles` table (no `is_admin` field)
- [ ] No admin-only routes or API endpoints

### 7.2 Content Moderation
- [ ] **❌ MISSING:** No way to remove/hide a video from the platform
- [ ] **❌ MISSING:** No way to delete or hide comments
- [ ] **❌ MISSING:** No content reporting mechanism for users
- [ ] **❌ MISSING:** No video review/approval workflow before content goes live

### 7.3 User Management
- [ ] **❌ MISSING:** No ability to ban or suspend a user
- [ ] **❌ MISSING:** No ability to delete a user account (admin side)
- [ ] **❌ MISSING:** No way to see all users or their activity

### 7.4 Suggested Admin Features to Build
- [ ] Admin role (`profiles.role = 'admin'`)
- [ ] Admin dashboard at `/admin` (protected by role check)
- [ ] User list with ability to suspend/delete accounts
- [ ] Video moderation queue (approve before public, or takedown after report)
- [ ] Comment moderation (delete any comment)
- [ ] Reports system — users flag content → admin reviews

---

## SECTION 8 — SYSTEM & INFRASTRUCTURE

### 8.1 Supabase Auth Configuration
- [ ] Site URL set to `https://hapieats-tv.vercel.app` ✅ (set earlier)
- [ ] Redirect URL allowlist includes `https://hapieats-tv.vercel.app/**` ✅ (set earlier)
- [ ] Email confirmation enabled
- [ ] Email templates customized (verify HapiEats branding, not default Supabase)
- [ ] Confirm email templates link to production domain

### 8.2 Mux Video Infrastructure
- [ ] **❌ NOT CONFIGURED:** Real Mux credentials not set in Vercel
- [ ] Mux webhook URL registered as `https://hapieats-tv.vercel.app/api/mux/webhook`
- [ ] `MUX_WEBHOOK_SECRET` matches what's in Mux dashboard
- [ ] `encoding_tier: 'baseline'` — confirm this is the intended tier (lowest cost, lower quality)
- [ ] Playback policy `'public'` — all uploads are publicly playable by Mux playback ID without auth

### 8.3 Stripe Billing Infrastructure
- [ ] **❌ NOT CONFIGURED:** Real Stripe credentials not set
- [ ] Stripe webhook registered at `https://hapieats-tv.vercel.app/api/stripe/webhook`
- [ ] Webhook subscribed to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Platform subscription Price ID (`NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID`) created in Stripe dashboard

### 8.4 Vercel Deployment
- [ ] Production domain `hapieats-tv.vercel.app` is live ✅
- [ ] All environment variables are set in Vercel dashboard (non-placeholder)
- [ ] Vercel Analytics enabled (optional but recommended)
- [ ] Build succeeds with no TypeScript errors ✅

### 8.5 Database
- [ ] All tables exist per schema (`videos`, `channels`, `profiles`, `live_streams`, `purchases`, `subscriptions`, `video_likes`, `comments`, `classes`, `class_enrollments`)
- [ ] `increment_channel_video_count` RPC function exists (called by Mux webhook)
- [ ] Foreign key constraints are correct
- [ ] Indexes exist on high-query columns (`videos.creator_id`, `videos.status`, `comments.video_id`, etc.)
- [ ] Database backups enabled in Supabase

### 8.6 Error Monitoring
- [ ] **❌ MISSING:** No error tracking (Sentry, LogRocket, etc.)
- [ ] Console errors only — no alerting on production failures
- [ ] Recommend: Add Sentry to both Next.js app and Supabase edge functions

### 8.7 Performance
- [ ] Images from Unsplash served via Next.js Image Optimization (`next/image`)
- [ ] `next.config.js` image domains include `images.unsplash.com`, `i.ytimg.com` ✅
- [ ] Search uses `ilike` — consider adding `pg_trgm` index for large datasets
- [ ] No caching layer on popular video queries — consider SWR or React Query on client

---

## SECTION 9 — MISSING FEATURES CHECKLIST

Features referenced in UI but not fully implemented:

| Feature | Status | Notes |
|---|---|---|
| Notifications (bell icon) | ⚠️ UI only | No backend — needs Supabase Realtime or polling |
| Stations (DB) | ⚠️ Sample only | No `stations` table, no real follow/upload-to-station |
| Subscribe to channel | ⚠️ Partial | Stripe subscription works but UI subscribe button needs wiring |
| Trending page (`/trending`) | ❌ Missing | Sidebar link exists, no page or route |
| Live page (`/live`) | ❌ Missing | Sidebar link exists, no browse page (only `/live/[id]` works) |
| About/Contact/Terms/Privacy | ❌ Missing | Footer links exist, no pages |
| Forgot password | ❌ Missing | No link on login page |
| Account deletion | ❌ Missing | No user-facing delete account option |
| Video edit (post-upload) | ❌ Missing | No way to edit title/description after upload |
| Video delete | ❌ Missing | No delete button in studio videos list |
| Creator analytics (detailed) | ⚠️ Basic only | Dashboard shows totals, no graphs or time-series |
| Search filters | ⚠️ Basic only | Only searches videos + channels, no date/category filter |
| Watch later / Save | ❌ Missing | No bookmarking feature |
| Channel banner image | ❌ Missing | No banner upload in channel settings |
| Playlist / Series support | ❌ Missing | Classes have series type but no real playlist |

---

## SECTION 10 — USER ACCOUNT MANAGEMENT

### 10.1 Self-Service Account Actions
- [ ] User can update display name ✅ (via `/dashboard/settings`)
- [ ] User can update bio ✅
- [ ] User can update avatar URL ✅
- [ ] **❌ MISSING:** No password change flow
- [ ] **❌ MISSING:** No email change flow
- [ ] **❌ MISSING:** No account/data deletion ("right to erasure" for GDPR)
- [ ] **❌ MISSING:** No way to disconnect Google OAuth account

### 10.2 Creator Account Actions
- [ ] Creator can update channel name ✅
- [ ] Creator can update channel description ✅
- [ ] Creator can change subscription price ✅ (creates new Stripe Price)
- [ ] **❌ MISSING:** No channel banner/avatar image upload (URL field only)
- [ ] **❌ MISSING:** No way to delete a channel

---

## AUDIT SUMMARY — PRIORITY MATRIX

### 🔴 Critical (Fix before public launch)
1. **Stream key exposure** — `GET /api/livestreams/[id]` may expose `stream_key`. Verify RLS or strip from response.
2. **Client-side price manipulation** — `pay_per_view` takes `priceInCents` from request body. Fetch price from DB server-side instead.
3. **Real credentials not set** — Mux and Stripe are still using placeholder keys in Vercel. Nothing requiring video upload or payment will work.

### 🟠 High (Fix soon)
4. **Open redirect** — `/login?redirect=` not validated. Restrict to relative paths only.
5. **Missing RLS verification** — Confirm RLS policies are enabled and correct on all sensitive tables.
6. **No rate limiting** — Comment posting, likes, and search endpoints can be abused.
7. **No admin/moderation tools** — No way to remove bad content or handle abuse reports.

### 🟡 Medium (Plan for next sprint)
8. **No error monitoring** — Add Sentry or similar.
9. **`avatar_url` not validated** — Add URL format check and domain allowlist.
10. **No forgot password link** on login page.
11. **Stations not persisted** — DB table + follow/upload functionality needed.
12. **Missing pages** — `/trending`, `/live` (browse), About, Terms, Privacy.
13. **No notification backend** — Bell icon is decorative.

### 🟢 Low (Backlog)
14. **Email template branding** — Customize Supabase email templates.
15. **Search performance** — Add `pg_trgm` indexes for scale.
16. **Video edit/delete in studio** — Post-upload management incomplete.
17. **Account deletion** — GDPR compliance consideration.
18. **Detailed creator analytics** — Charts, time-series, per-video breakdown.
