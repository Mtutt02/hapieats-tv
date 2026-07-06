# HapiEats TV — Claude Handoff Document

> **Last updated:** 2026-07-05  
> **Live site:** https://hapieatstv.com  
> **Vercel project:** `melivate/hapieats-tv`  
> **GitHub:** https://github.com/Mtutt02/hapieats-tv.git  
> **Branch:** `main`

---

## Project Stack

| Layer | Service |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database + Auth | Supabase (Postgres + RLS + Realtime) |
| Video | Mux (`@mux/mux-node ^8.6.0`, `@mux/mux-player-react ^2.8.1`) |
| Payments | Stripe (subscriptions + Connect) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel (Hobby plan) via `C:\Projects\DEPLOY_HAPIEATS.bat` |

---

## Current Live State (as of 2026-07-05)

### Deployment
- **Production URL:** https://hapieatstv.com  
- **Active Vercel deployment:** `hapieats-plg9ilxca-melivate.vercel.app`  
- Both `hapieatstv.com` and `www.hapieatstv.com` are aliased to this deployment.
- Latest commits on `main`:
  - `d39714a` Fix route conflict: remove duplicate live/[streamId] route
  - `2d2cfc4` Fresh start — remove build artifacts from history

### TV Browser (`/tv`)
The TV browser is a fully custom experience at `/tv`. Key features live in production:
- **Full viewport screen** — TV fills `calc(100svh - 56px)` with bezel/scanline/vignette aesthetic
- **Fullscreen mode** — native browser Fullscreen API (`F` key or remote button)
- **Picture-in-Picture** — PiP API with MuxPlayer shadow DOM traversal (`P` key or remote)
- **Physical floating remote** — slides up from bottom of screen, collapsible (`R` key or pull tab)
- **Horizontal EPG guide** — slides up inside TV screen (replaces old side panel), `G` key
- **On-Screen Display (OSD)** — auto-shows on channel change, times out after 4.5s
- **Channel switching animation** — 300ms black flash with channel number overlay
- **Number pad direct tune** — type 2-digit channel number on remote, auto-confirms after 1.2s

### Keyboard shortcuts
| Key | Action |
|---|---|
| `↑` / `→` | Channel up |
| `↓` / `←` | Channel down |
| `M` | Toggle mute |
| `G` | Toggle channel guide |
| `F` | Toggle fullscreen |
| `P` | Toggle Picture-in-Picture |
| `R` | Toggle remote visibility |
| `Escape` | Close guide |

---

## Deployment Workflow

### Normal deploy
```bash
C:\Projects\DEPLOY_HAPIEATS.bat
```
This script:
1. Copies source to temp dir (excluding node_modules, .next, .env*)
2. Inits a fresh git repo (avoids large-file history issues)
3. Force-pushes to GitHub → triggers Vercel build
4. Polls for READY status
5. Runs `vercel alias` to point hapieatstv.com to the new deployment

### Manual alias (if needed)
```bash
cd C:\Projects\hapieats-tv
vercel alias <deployment-url> hapieatstv.com
vercel alias <deployment-url> www.hapieatstv.com
```

### Check current aliases
```bash
vercel ls
vercel alias ls
```

### Cron
Vercel Hobby plan = max **one cron per day**. Current cron in `vercel.json`:
```json
{ "path": "/api/admin/ai-moderate", "schedule": "0 6 * * *" }
```
Do NOT change to a more frequent schedule — it will cause a build error.

---

## Architecture — Key Files

### TV Experience
| File | Purpose |
|---|---|
| `components/tv/TVBrowser.tsx` | **Main TV component** — all TV state, OSD, guide, remote |
| `app/tv/page.tsx` | TV page — fetches channels, renders TVBrowser |

### TVBrowser internals
- `TVChannel` interface — `number, name, icon, description, videoUrl?, muxPlaybackId?, isLive?, currentTitle, category`
- `OSD` — on-screen display overlay, fades in/out
- `ChannelGuide` — horizontal scrolling EPG strip anchored to bottom of TV screen
- `PhysicalRemote` — D-pad + numpad + function row, physical skeuomorphic look
- `FloatingRemote` — wraps PhysicalRemote, max-height CSS transition for open/close drawer
- `MuxPlayerWrapper` — lazy-loads `@mux/mux-player-react`, hides native controls, cover fit
- `findVideoElement()` — traverses shadow DOM to find `<video>` inside `<mux-player>` for PiP

### Live Rooms
- `app/live/[id]/page.tsx` — server component; fetches stream + 60 messages + gifts + profile
- `components/live/LiveRoomClient.tsx` — client; Supabase Realtime on `live_chat:${stream.id}`
- Profile cache via `useRef` (not state) — avoids re-renders on cache update
- `export const dynamic = 'force-dynamic'` on page to skip static generation

### Token Ecosystem
| Table | Purpose |
|---|---|
| `hapi_tokens` | User balances (debit via `record_token_movement` RPC with `SELECT FOR UPDATE`) |
| `live_gifts` | Gift catalog (never trust client cost — DB is source of truth) |
| `live_gift_transactions` | Audit log with creator/platform/pool split |
| `creator_wallets` | Creator earnings (upserted after each gift) |

### Supabase Client Pattern
- `createClient()` — cookie-based, for user-scoped reads in server components + API routes
- `createServiceClient()` — service role, for admin writes (gift inserts, system messages, token debits)

### TopBar Height
- Mobile: `48px` (`h-12`)
- Desktop: `56px` (`sm:h-14`)
- TV browser uses `h-[calc(100svh-56px)]` to avoid scrollbar

---

## Features Added (Session History)

### Session 1–2: Core Platform
- Supabase auth + RLS on all tables
- Stripe subscriptions + Connect payouts
- Mux video upload + webhook handler
- Live streaming with WHIP + live chat
- Gift economy with token system
- Creator Studio (upload, manage, analytics)

### Session 3: Food Platform Features (2026-07-01)
- **Recipe Cards** on watch page — `components/recipe/RecipeCard.tsx`
- **"Tried This" reaction** — `components/video/TriedThisButton.tsx`
- **Chef Verification Badge** — `components/badges/VerifiedChefBadge.tsx`
- **Cuisine & Dietary Tags filter bar** — `components/filters/CuisineTags.tsx`
- **Cook Time filter** — added to `components/home/HomeClient.tsx`
- DB migration: `supabase/migrations/20260701_recipe_cards.sql`

### Session 4: TV UI Overhaul (2026-07-05)
- **TV screen fills viewport** — was too small, now uses all available space
- **Fullscreen API** — `requestFullscreen()` on bezel container
- **Picture-in-Picture** — shadow DOM traversal to reach `<video>` inside MuxPlayer
- **Physical floating remote** — replaces flat button row; collapsible from bottom
- **Horizontal EPG guide** — replaces old side panel; slides up from TV bottom
- **Route conflict fixed** — deleted `app/(viewer)/live/[streamId]/` (duplicate of `app/live/[id]/`)
- **Cron fixed** — changed from `*/10 * * * *` (Pro only) to `0 6 * * *` (Hobby OK)
- **Git history cleanup** — deleted `.git`, fresh init to remove committed `.next/` + `node_modules/` from history
- **Domain re-aliased** — `hapieatstv.com` was pointing to old deployment; re-aliased to `hapieats-plg9ilxca-melivate.vercel.app`

---

## Critical Rules

### ALWAYS READ BACK FILES AFTER WRITING
Before marking any task done, re-read the file you just created or edited. A build failure wastes a full deploy cycle.

### JSX COMMENT PLACEMENT
```tsx
// ❌ WRONG — {/* */} before the opening tag throws a parse error
return (
  {/* my comment */}
  <div>...</div>
)

// ✅ CORRECT
return (
  <div>
    {/* my comment */}
  </div>
)
```

### CHECK FOR ROUTE CONFLICTS before creating any new page
`app/(viewer)/live/[streamId]/` and `app/live/[id]/` both resolve to `/live/:x` — Next.js errors if slug names differ.
```bash
# Check before adding any page under /live/
Glob("**/live/**/*", "C:\Projects\hapieats-tv\app")
```

### TypeScript errors stop Vercel builds
Run `npx tsc --noEmit` before deploying. Common killers:
- JSX comment before root element
- Multiple children without Fragment
- `await` in non-async function
- Possibly-null access without narrowing

### NEVER commit `.next/` or `node_modules/`
The `.gitignore` covers these, but if they slip into a commit (e.g. before gitignore was applied), GitHub will reject the push with a file-size error. Fix = fresh `git init`:
```bash
cd C:\Projects\hapieats-tv
rm -rf .git
git init
git add .
git commit -m "Fresh start"
git remote add origin https://github.com/Mtutt02/hapieats-tv.git
git push -f origin main
```

---

## Security Constraints (non-negotiable)

- **Never erase user data on deploy** — migrations must be additive (`CREATE IF NOT EXISTS`, `ALTER ADD COLUMN IF NOT EXISTS`)
- **RLS on every table** — service role for gift/system inserts; user-scoped policies for everything else
- **Gateway checks** — every API route checks `auth.getUser()` first; ownership verified before any mutation
- **No data leaking** — stream keys, private messages, and admin-only fields must never reach the client

---

## Known Issues / Gotchas

| Issue | Status | Notes |
|---|---|---|
| VOL +/− on remote | Placeholder (no-op) | Real volume control requires wiring to MuxPlayer's `volume` prop; currently only mute is implemented |
| PiP on some mobile browsers | May silently fail | Caught in try/catch; PiP badge only shows when API confirms entry |
| Channel guide `scrollIntoView` | 80ms delay | Required to let the DOM render before measuring position |
| Vercel cron on Hobby plan | Once/day max | `/api/admin/ai-moderate` runs at 06:00 daily |
| Supabase recipe cards migration | Manual step | Run `supabase db push` if recipe cards aren't showing on watch pages |

---

## Daily Health Check

A scheduled check runs every day to verify hapieatstv.com is live and reflecting the latest build.  
Check: site loads, `/tv` route responds, no build-stale content.

---

## Environment Variables (Vercel)

These must be set in the Vercel dashboard for production:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID
NEXT_PUBLIC_APP_URL=https://hapieatstv.com
```

Never commit `.env.local`. It is in `.gitignore`.
