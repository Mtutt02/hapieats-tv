# HapiEats TV — Developer Handoff Document

> **Purpose:** Complete reference for a new developer to access, understand, upgrade, or rebuild HapiEats TV from scratch.  
> **Last updated:** 2026-07-05  
> **Maintained by:** Update this file whenever a new service is added, credentials change, or architecture shifts.

---

## Table of Contents

1. [Service Accounts & Access Links](#1-service-accounts--access-links)
2. [Repository & Code Access](#2-repository--code-access)
3. [Environment Variables (Complete List)](#3-environment-variables-complete-list)
4. [Tech Stack](#4-tech-stack)
5. [Rebuild From Scratch — Step by Step](#5-rebuild-from-scratch--step-by-step)
6. [Database — Full Schema & Migration Order](#6-database--full-schema--migration-order)
7. [App Architecture & Key Files](#7-app-architecture--key-files)
8. [All Routes (Pages + API)](#8-all-routes-pages--api)
9. [Deployment](#9-deployment)
10. [Monetization & Token Economy](#10-monetization--token-economy)
11. [Critical Rules & Gotchas](#11-critical-rules--gotchas)
12. [Daily Health Check](#12-daily-health-check)

---

## 1. Service Accounts & Access Links

These are the external services the app depends on. Each one requires account access to manage keys, webhooks, and configuration.

### Vercel (Hosting)
- **Dashboard:** https://vercel.com/melivate/hapieats-tv
- **Account:** melivate
- **Plan:** Hobby (free) — 1 cron/day max, no team features
- **Live domain:** https://hapieatstv.com
- **Upgrade path:** https://vercel.com/pricing — Pro plan ($20/mo) unlocks frequent crons, team access, advanced analytics
- **CLI:** `npm install -g vercel` then `vercel login`

### GitHub (Source Control)
- **Repo:** https://github.com/Mtutt02/hapieats-tv
- **Branch:** `main`
- **Account:** Mtutt02
- **Clone:** `git clone https://github.com/Mtutt02/hapieats-tv.git`

### Supabase (Database + Auth)
- **Dashboard:** https://supabase.com/dashboard
- **Project name:** hapieats-tv (find it in the project list)
- **Project URL format:** `https://<ref>.supabase.co`
- **Keys location:** Dashboard → Project Settings → API
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`
- **Auth config:** Dashboard → Authentication → URL Configuration
- **SQL Editor:** Dashboard → SQL Editor (run migrations manually here)
- **Plan:** Free tier — 500MB DB, 2GB bandwidth, 50k monthly active users
- **Upgrade:** https://supabase.com/pricing — Pro plan ($25/mo)

### Mux (Video Hosting & Live Streaming)
- **Dashboard:** https://dashboard.mux.com
- **Account:** log in with the project email
- **Access tokens:** Dashboard → Settings → Access Tokens
  - Token ID → `MUX_TOKEN_ID`
  - Token Secret → `MUX_TOKEN_SECRET`
- **Webhooks:** Dashboard → Settings → Webhooks
  - Endpoint: `https://hapieatstv.com/api/mux/webhook`
  - Signing Secret → `MUX_WEBHOOK_SECRET`
- **WHIP endpoint (live streaming):** provided by Mux when a live stream is created via API
- **Pricing:** https://www.mux.com/pricing — pay-per-usage (encoding + delivery)

### Stripe (Payments)
- **Dashboard:** https://dashboard.stripe.com
- **Mode:** Switch between Test and Live in top-left corner
- **API keys:** Dashboard → Developers → API Keys
  - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Secret key → `STRIPE_SECRET_KEY`
- **Webhooks:** Dashboard → Developers → Webhooks
  - Endpoint: `https://hapieatstv.com/api/stripe/webhook`
  - Signing Secret → `STRIPE_WEBHOOK_SECRET`
  - Events to listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `payment_intent.succeeded`
- **Platform subscription price:** Dashboard → Products → find "Platform Pass" → copy Price ID → `NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID`
- **Stripe Connect:** Creators onboard via Stripe Express (connected accounts). Creator's Stripe account ID stored in `profiles.stripe_account_id`
- **CLI (local dev):** `stripe listen --forward-to localhost:3000/api/stripe/webhook`

---

## 2. Repository & Code Access

```bash
# Clone the repo
git clone https://github.com/Mtutt02/hapieats-tv.git
cd hapieats-tv

# Install dependencies
npm install

# Run locally
npm run dev
```

**Local URL:** http://localhost:3000  
**TV browser:** http://localhost:3000/tv

### Deploy script (Windows)
```
C:\Projects\DEPLOY_HAPIEATS.bat
```
This script does a fresh-init deploy to avoid git history issues with large files.

---

## 3. Environment Variables (Complete List)

Create `.env.local` in the project root (never commit this file — it's in `.gitignore`).  
All of these must also be set in Vercel → Project Settings → Environment Variables.

```bash
# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://hapieatstv.com

# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key — NEVER expose to client>

# ── Mux ──────────────────────────────────────────────────────────────────────
MUX_TOKEN_ID=<access token ID from Mux Settings → Access Tokens>
MUX_TOKEN_SECRET=<access token secret>
MUX_WEBHOOK_SECRET=<webhook signing secret from Mux Settings → Webhooks>

# ── Stripe ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...   # or pk_test_... for dev
STRIPE_SECRET_KEY=sk_live_...                    # or sk_test_... for dev
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID=price_...   # Platform Pass price ID
```

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are server-only. Never use them in client components or prefix them with `NEXT_PUBLIC_`.

---

## 4. Tech Stack

| Layer | Library / Service | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript | ^5 |
| Database | Supabase (Postgres) | ^2.108.2 |
| Auth | Supabase Auth | included |
| Realtime | Supabase Realtime | included |
| Video | Mux Player React | ^2.8.1 |
| Video API | Mux Node | ^8.6.0 |
| Payments | Stripe | ^16.2.0 |
| Styling | Tailwind CSS | ^3.4.1 |
| Components | shadcn/ui + Radix UI | various |
| Forms | React Hook Form + Zod | ^7 / ^3 |
| Charts | Recharts | ^2.12.7 |
| State | Zustand | ^4.5.4 |
| Icons | Lucide React | ^0.400.0 |
| Upload | Mux UpChunk | ^3.3.1 |
| Analytics | Vercel Analytics + Speed Insights | ^1 |
| Hosting | Vercel | Hobby plan |

---

## 5. Rebuild From Scratch — Step by Step

Follow this in order. Don't skip steps.

### Step 1 — Create service accounts
1. **GitHub:** Create account at https://github.com, create repo `hapieats-tv`
2. **Vercel:** Sign up at https://vercel.com, connect GitHub account
3. **Supabase:** Create project at https://supabase.com
4. **Mux:** Create account at https://mux.com, create access token
5. **Stripe:** Create account at https://stripe.com

### Step 2 — Clone and install
```bash
git clone https://github.com/Mtutt02/hapieats-tv.git
cd hapieats-tv
npm install
```

### Step 3 — Configure environment variables
```bash
cp .env.example .env.local
# Fill in all values from each service dashboard (see Section 3)
```

### Step 4 — Configure Supabase Auth
In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000` (dev) or `https://hapieatstv.com` (prod)
- **Redirect URLs:** Add both `http://localhost:3000/auth/callback` and `https://hapieatstv.com/auth/callback`

In Authentication → Providers:
- Enable **Email** (on by default)
- Enable **Google** if you want OAuth sign-in (requires Google Cloud OAuth credentials)

### Step 5 — Run database migrations
```bash
# Install Supabase CLI
npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref <your-project-ref>

# Push all migrations (runs them in filename order)
supabase db push
```

If `supabase db push` fails on any migration, run them manually in order through the Supabase SQL Editor (Dashboard → SQL Editor → New query). See Section 6 for the full order.

### Step 6 — Create Stripe products
1. Create a **Platform Pass** product with a recurring monthly price
2. Copy the Price ID → add to env as `NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID`
3. Set up webhook endpoint pointing to `https://hapieatstv.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `customer.subscription.*`, `payment_intent.succeeded`

### Step 7 — Set up Mux webhook
In Mux Dashboard → Settings → Webhooks:
- Add endpoint: `https://hapieatstv.com/api/mux/webhook`
- Events to subscribe: `video.asset.ready`, `video.asset.errored`, `video.live_stream.active`, `video.live_stream.idle`
- Copy signing secret → `MUX_WEBHOOK_SECRET`

### Step 8 — Run locally and verify
```bash
npm run dev
# In a second terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Visit http://localhost:3000 — register a user, upload a video, verify it processes through Mux.

### Step 9 — Deploy to Vercel
```bash
# First time setup
vercel link
# Then deploy
C:\Projects\DEPLOY_HAPIEATS.bat
# Or manually:
vercel --prod
```

Add all env vars in Vercel dashboard before deploying to production.

### Step 10 — Point domain to Vercel
In Vercel → Project → Settings → Domains:
- Add `hapieatstv.com` and `www.hapieatstv.com`
- Follow DNS instructions to update your domain registrar
- After Vercel has the domain, run:
  ```bash
  vercel alias <deployment-url> hapieatstv.com
  vercel alias <deployment-url> www.hapieatstv.com
  ```

### Step 11 — Update all webhook URLs to production
- Supabase Auth: change Site URL and Redirect URLs to `https://hapieatstv.com`
- Mux webhook: update endpoint URL
- Stripe webhook: update endpoint URL

### Step 12 — Make yourself admin
In Supabase SQL Editor, after creating your account:
```sql
UPDATE profiles SET role = 'superadmin' WHERE username = 'your-username';
```

---

## 6. Database — Full Schema & Migration Order

Run migrations in this exact order. All files are in `supabase/migrations/`.

```
001_initial.sql              ← Core tables: profiles, channels, videos, subscriptions, purchases, video_views
002_live_streams.sql         ← live_streams table
003_comments_likes.sql       ← comments, video_likes tables + like/comment count triggers
004_classes.sql              ← classes, class_lessons, class_enrollments
002_tv_lineup.sql            ← tv_channels table (custom TV browser lineup)
20260623_feature_expansion.sql   ← Additional profile fields, follow system, bookmarks, notifications
20260623_stations.sql            ← Radio-style station channels
20260624_flavor_points.sql       ← Flavor Points reward system
20260624_security_fixes.sql      ← Security policy patches
20260624_moderator_role.sql      ← Admin/moderator role column on profiles
20260624_setup_all.sql           ← Consolidated setup helpers
20260624_comment_reports.sql     ← Comment reporting system
20260624_fix_upload.sql          ← Upload flow fixes
20260625_security_rls_fixes.sql  ← Additional RLS hardening
20260701_security_hardening.sql  ← Further security improvements
20260701_recipe_cards.sql        ← recipe_cards, tried_this tables + is_verified_chef on profiles
20260701_chef_verification.sql   ← Chef verification system
20260702_app_credits.sql         ← App credits system (gift + loan balances)
20260703_credit_requests.sql     ← Credit request flow
20260703_monetization_unlock.sql ← Monetization unlock gates
20260703_creator_ecosystem.sql   ← Token economy: hapi_tokens, token_ledger, creator_wallets, live_gifts, live_gift_transactions, creator_challenges, creator_goals, creator_streaks, creator_circle_pool
20260703_creator_ecosystem_functions.sql  ← DB functions: record_token_movement, update_creator_streak, ensure_token_wallet, ensure_creator_wallet
20260703_security_patches.sql    ← Security patches for new tables
20260703_live_chat.sql           ← live_chat_messages table + Realtime-ready RLS
```

### Core tables summary

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user. Extends `auth.users`. Holds username, avatar, Stripe IDs, `is_creator`, `role`, `is_verified_chef` |
| `channels` | Creator channels. Has `slug` for routing, `subscription_price`, Stripe price ID |
| `videos` | Video records. Linked to Mux via `mux_asset_id` + `mux_playback_id`. Status: `uploading → processing → ready` |
| `live_streams` | Live stream sessions. `stream_key` is private (creator only). WHIP endpoint from Mux |
| `live_chat_messages` | Real-time chat for live rooms. Types: `message`, `gift_event`, `system` |
| `subscriptions` | Channel subscriptions via Stripe |
| `purchases` | Pay-per-view purchases via Stripe |
| `video_views` | View tracking. Triggers `view_count` increment on `videos` |
| `comments` | Video comments. Triggers `comment_count` on `videos` |
| `video_likes` | Likes. Triggers `like_count` on `videos` |
| `classes` | Creator classes (recorded, live, or series). Pricing model same as videos |
| `class_lessons` | Lessons inside a class. Ordered by `order_index` |
| `class_enrollments` | User enrollments in classes |
| `recipe_cards` | Recipe attached to a video. JSONB for ingredients + steps |
| `tried_this` | "Tried This" reactions (one per user per video) |
| `hapi_tokens` | User token wallet. Balance + lifetime stats |
| `token_ledger` | Immutable log of every token movement |
| `creator_wallets` | Creator earnings in cents (pending + redeemable) |
| `live_gifts` | Gift catalog (Flame 🔥, Chef Kiss 🤌, Hapi Bowl 🍜, etc.) |
| `live_gift_transactions` | Gift transaction log with split: 70% creator / 20% platform / 10% pool |
| `token_packs` | Purchasable token bundles (Starter 100 tokens, Fan Pack 500, etc.) |
| `creator_challenges` | Community cooking challenges with prizes |
| `creator_goals` | Fan-funded creator goals |
| `creator_streaks` | Daily posting streaks with milestone bonuses |
| `creator_circle_pool` | Monthly pool funded by gift fees, distributed to top creators |
| `app_credits` | Gift/loan credit balances for users |
| `platform_settings` | Key-value config (token conversion rates, streak bonuses) |

### Key DB functions
| Function | What it does |
|---|---|
| `handle_new_user()` | Auto-creates `profiles` row when auth user signs up (trigger on `auth.users`) |
| `record_token_movement()` | Atomic token credit/debit with ledger entry. Always use this, never UPDATE `hapi_tokens` directly |
| `update_creator_streak()` | Updates streak after a post/stream/challenge. Call from API routes |
| `ensure_token_wallet()` | Creates wallet row if not exists, returns balance |
| `ensure_creator_wallet()` | Creates creator_wallets row if not exists |

### Supabase Realtime
Enable Realtime for `live_chat_messages` in Dashboard → Database → Replication → Supabase Realtime.  
The client subscribes to: `live_chat:${stream.id}` (channel name format).

---

## 7. App Architecture & Key Files

```
hapieats-tv/
├── app/                        ← Next.js App Router pages
│   ├── (viewer)/               ← Route group: viewer-facing pages
│   │   ├── watch/[videoId]/    ← Video player + paywall
│   │   ├── profile/[username]/ ← Creator profile
│   │   └── channel/[slug]/     ← Channel page
│   ├── live/[id]/              ← Live room (DO NOT add duplicate routes under (viewer)/live/)
│   ├── tv/                     ← TV browser page
│   ├── studio/                 ← Creator Studio (upload, manage, go live)
│   ├── dashboard/              ← Creator analytics
│   ├── admin/                  ← Admin panel (role-gated)
│   └── api/                    ← API routes
│       ├── mux/webhook/        ← Mux event handler
│       ├── stripe/webhook/     ← Stripe event handler
│       ├── stripe/checkout/    ← Create checkout session
│       ├── tokens/             ← Token purchase + gift endpoints
│       ├── live/               ← Live stream management
│       ├── recipe/             ← Recipe card CRUD
│       ├── admin/              ← Admin-only endpoints (ai-moderate cron lives here)
│       └── auth/callback/      ← Supabase OAuth redirect
│
├── components/
│   ├── tv/TVBrowser.tsx        ← MAIN TV COMPONENT (physical remote, EPG, PiP, fullscreen)
│   ├── live/LiveRoomClient.tsx ← Live room real-time chat client
│   ├── studio/                 ← Upload studio, go live UI
│   ├── recipe/RecipeCard.tsx   ← Recipe card display
│   ├── video/TriedThisButton.tsx
│   ├── badges/VerifiedChefBadge.tsx
│   ├── filters/CuisineTags.tsx ← Horizontal cuisine filter bar
│   └── home/HomeClient.tsx     ← Homepage feed + filters
│
├── lib/
│   ├── supabase/               ← createClient() + createServiceClient()
│   └── utils.ts                ← cn() helper
│
├── supabase/
│   └── migrations/             ← All SQL migrations (run in order)
│
├── types/
│   └── supabase.ts             ← Auto-generated DB types (run: npm run db:types)
│
├── vercel.json                 ← Build config + cron definition
├── CLAUDE.md                   ← Claude AI coding standards + quick reference
└── DEVELOPER_HANDOFF.md        ← This file
```

### Supabase client pattern
```typescript
// For server components + API routes (user-scoped)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// For admin writes (gift inserts, system messages, token debits)
import { createServiceClient } from '@/lib/supabase/server'
const supabase = createServiceClient()
// No RLS bypass needed — service_role policies cover admin writes
```

### TV Browser component structure
`components/tv/TVBrowser.tsx` contains all TV logic in one file:
- `TVChannel` interface — the shape of each channel
- `OSD` — on-screen display overlay (channel info, auto-hides after 4.5s)
- `ChannelGuide` — horizontal scrolling EPG strip, slides up from TV bottom
- `PhysicalRemote` — D-pad + numpad + function row
- `FloatingRemote` — drawer shell wrapping PhysicalRemote (CSS max-height transition)
- `MuxPlayerWrapper` — lazy-loaded Mux player with shadow DOM traversal for PiP
- `findVideoElement()` — finds `<video>` inside MuxPlayer shadow DOM for PiP API

---

## 8. All Routes (Pages + API)

### Page routes
| Route | Description | Auth required |
|---|---|---|
| `/` | Homepage — video discovery feed | No |
| `/login` | Sign in | No |
| `/register` | Sign up | No |
| `/tv` | TV browser experience | No |
| `/watch/[videoId]` | Video player + paywall | Depends on pricing |
| `/live/[id]` | Live room — real-time stream + chat | No |
| `/profile/[username]` | Creator profile page | No |
| `/channel/[slug]` | Channel page | No |
| `/studio` | Creator Studio home | Creator |
| `/studio/upload` | Upload new video | Creator |
| `/studio/videos` | Manage videos | Creator |
| `/studio/live` | Go live setup | Creator |
| `/dashboard` | Creator analytics | Creator |
| `/admin` | Admin panel | Admin role |

### API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/mux/upload` | POST | Create Mux direct upload URL + video record |
| `/api/mux/webhook` | POST | Handle Mux asset/stream events |
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/webhook` | POST | Handle Stripe payment/subscription events |
| `/api/tokens/purchase` | POST | Buy token pack via Stripe |
| `/api/tokens/gift` | POST | Send gift during live stream |
| `/api/live/create` | POST | Create Mux live stream |
| `/api/live/end` | POST | End a live stream |
| `/api/recipe` | GET/POST | Get/create recipe card for a video |
| `/api/videos/[id]/tried` | POST | Toggle "Tried This" reaction |
| `/api/admin/ai-moderate` | POST | AI content moderation (cron at 06:00 daily) |
| `/auth/callback` | GET | Supabase OAuth redirect handler |

---

## 9. Deployment

### Normal deploy (Windows)
```bash
C:\Projects\DEPLOY_HAPIEATS.bat
```

### Manual deploy (PowerShell / terminal)
```bash
cd C:\Projects\hapieats-tv

# Check TypeScript before deploying (catches silent build failures)
npx tsc --noEmit

# Deploy
vercel --prod

# After deploy, check if domain is pointing to new deployment
vercel ls           # find the new deployment URL (format: hapieats-XXXXX-melivate.vercel.app)
vercel alias ls     # see current domain → deployment mapping

# Re-alias if needed
vercel alias hapieats-XXXXX-melivate.vercel.app hapieatstv.com
vercel alias hapieats-XXXXX-melivate.vercel.app www.hapieatstv.com
```

### Why fresh-init deploy?
The project uses a fresh `git init` on every deploy (see `DEPLOY_HAPIEATS.bat`). This is because `.next/` and `node_modules/` were accidentally committed in early history. GitHub blocks pushes with files over 100MB. Fresh init avoids carrying that history.

If you ever need to push normally:
```bash
git add .
git commit -m "your message"
git push origin main
# If rejected for large files: use the deploy script which does fresh-init
```

### Vercel cron
Cron is defined in `vercel.json`:
```json
{ "path": "/api/admin/ai-moderate", "schedule": "0 6 * * *" }
```
**Do not change to a more frequent schedule.** Vercel Hobby plan allows max once/day. Any more frequent pattern will cause the build to fail with a plan restriction error.

### Upgrade cron frequency
Upgrade Vercel to Pro plan ($20/mo) at https://vercel.com/pricing, then you can use `*/10 * * * *` or similar.

---

## 10. Monetization & Token Economy

### Video pricing models
Each video has a `pricing_model` field:
- `free` — anyone watches
- `pay_per_view` — one-time Stripe payment, creates `purchases` row
- `subscription` — requires active `subscriptions` row for that channel OR platform subscription (`profiles.platform_subscription_status = 'active'`)

### Token system (Hapi Tokens)
1. Users buy tokens via token packs (Stripe → `/api/tokens/purchase`)
2. Tokens are stored in `hapi_tokens.balance`
3. All movements logged in `token_ledger` — never update `hapi_tokens` directly, always call `record_token_movement()`
4. Gifts sent during live streams split: **70% creator / 20% platform / 10% creator circle pool**
5. Creator earnings accumulate in `creator_wallets.redeemable_cents`
6. Creator cashes out via Stripe Connect

### Conversion rate
Set in `platform_settings`:
- Key: `token_conversion_rate`
- Default: `{ "creator_pct": 70, "platform_pct": 20, "circle_pool_pct": 10, "cents_per_token": 1 }`

### Token packs (default seeded)
| Pack | Tokens | Price |
|---|---|---|
| Starter | 100 | $1.99 |
| Fan Pack | 500 | $7.99 |
| Supporter | 1,200 | $17.99 |
| Super Fan | 2,750 | $39.99 |
| VIP | 6,000 | $79.99 |

### Gifts (default seeded)
| Gift | Emoji | Tokens |
|---|---|---|
| Flame | 🔥 | 10 |
| Chef Kiss | 🤌 | 25 |
| Hapi Bowl | 🍜 | 50 |
| Golden Fork | 🍴 | 100 |
| Hapi Crown | 👑 | 500 |
| Star Chef | ⭐ | 1,000 |

### App Credits
Users can receive gift credits (no repayment) or loan credits (auto-deducted from creator cashouts or repaid via Stripe). Tracked in `app_credits`, `credit_grants`, and `credit_ledger`.

---

## 11. Critical Rules & Gotchas

### NEVER commit `.next/` or `node_modules/`
They are in `.gitignore` but if they slip in before the gitignore was applied, GitHub will reject the push. Fix = delete `.git` and do a fresh init.

### Route conflicts — check before adding new pages
`app/(viewer)/live/[streamId]/` and `app/live/[id]/` resolve to the same URL.  
If slug names differ (`streamId` vs `id`), Next.js throws: `You cannot use different slug names for the same dynamic path`.  
**Always glob for existing routes before adding a page:**
```bash
# Before adding any page under /live/
ls app/**/live/
```

### JSX comment placement
```tsx
// ❌ WRONG — breaks TypeScript parsing
return (
  {/* comment */}
  <div>...</div>
)

// ✅ CORRECT — comment inside root element
return (
  <div>
    {/* comment */}
  </div>
)
```

### TypeScript errors stop Vercel builds silently
Run `npx tsc --noEmit` before deploying. Common issues:
- JSX comment before root element
- Multiple JSX children without Fragment
- `await` in non-async function
- Possibly-null access without narrowing

### DB migrations must be additive
Never drop columns or tables that have existing user data. Always:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS new_column text;
CREATE TABLE IF NOT EXISTS new_table (...);
```

### Service role vs cookie client
- `createClient()` — cookie-based, respects RLS as the logged-in user
- `createServiceClient()` — service role, bypasses RLS. Only use for admin writes and system operations.
- All API routes must call `auth.getUser()` first and verify ownership before any mutation.

### PiP with Mux Player
MuxPlayer is a custom element (`<mux-player>`) that may nest `<video>` inside a shadow DOM. `findVideoElement()` in TVBrowser.tsx handles this by trying direct querySelector first, then shadow DOM traversal. If PiP fails silently, the try/catch swallows the error — check browser console for DOMException.

### Vercel domain aliasing
Vercel does not always auto-alias your custom domain to the newest deployment. After a deploy, always check:
```bash
vercel alias ls
```
And re-alias if the domain still points to an old deployment.

---

## 12. Daily Health Check

A scheduled task runs every day at 9:00 AM to verify:
- https://hapieatstv.com loads (200 OK, real content)
- https://hapieatstv.com/tv responds
- Vercel domain alias points to the latest READY deployment
- If stale: auto re-aliases to current deployment

Configured in Claude Cowork scheduled tasks → `hapieatstv-daily-health-check`.

---

## Quick Reference: "Something Is Broken"

| Symptom | Likely cause | Fix |
|---|---|---|
| Live site shows old UI | Domain alias stale | `vercel alias <new-url> hapieatstv.com` |
| Build fails on Vercel | TypeScript error or cron plan issue | `npx tsc --noEmit` locally; check `vercel.json` cron schedule |
| GitHub push rejected (file too large) | Build artifacts in git history | Fresh init: delete `.git`, `git init`, add, commit, force push |
| Videos not processing | Mux webhook not firing | Check Mux dashboard → Webhooks → recent deliveries |
| Stripe payments failing | Webhook endpoint wrong or secret mismatch | Regenerate signing secret in Stripe dashboard, update env var |
| Auth not working | Supabase redirect URL mismatch | Dashboard → Authentication → URL Configuration → add domain |
| New user has no profile | `handle_new_user` trigger missing | Check `auth.users` trigger in Supabase → Database → Triggers |
| Token balance wrong | Direct UPDATE on `hapi_tokens` (don't do this) | Use `record_token_movement()` RPC exclusively |
| /live route conflict | Two pages with different slug names | Delete the duplicate under `app/(viewer)/live/` |
