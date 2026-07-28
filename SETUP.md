# HapiEats TV — Setup Guide

## Tech Stack
| Layer | Service |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase |
| Video | Mux |
| Payments | Stripe |
| Styling | Tailwind CSS + shadcn/ui |

---

## 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Mux](https://mux.com) account
- A [Stripe](https://stripe.com) account

---

## 2. Install Dependencies

```bash
cd hapieats-tv
npm install
```

---

## 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

### Supabase
1. Go to **Project Settings → API**
2. Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### Mux
1. Go to **Settings → Access Tokens** → Create token
2. Copy Token ID → `MUX_TOKEN_ID`
3. Copy Token Secret → `MUX_TOKEN_SECRET`
4. Go to **Settings → Webhooks** → Add endpoint: `https://yourdomain.com/api/mux/webhook`
5. Copy Signing Secret → `MUX_WEBHOOK_SECRET`

### Stripe
1. Go to **Developers → API Keys**
2. Copy Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy Secret key → `STRIPE_SECRET_KEY`
4. Set up webhook: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
6. Create a "Platform Subscription" price in Stripe → copy Price ID → `NEXT_PUBLIC_STRIPE_PLATFORM_PRICE_ID`

---

## 4. Database Setup

Install the Supabase CLI, then push the schema:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This runs `supabase/migrations/001_initial.sql` which creates:
- `profiles` — extends Supabase Auth users
- `channels` — creator channels
- `videos` — video records linked to Mux assets
- `subscriptions` — channel subscription records
- `purchases` — pay-per-view purchases
- `video_views` — view tracking

---

## 5. Supabase Auth Configuration

In your Supabase dashboard:
1. **Authentication → Providers** → Enable Email + Google (optional)
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (dev) or your production URL
   - Redirect URLs: add `http://localhost:3000/auth/callback`

---

## 6. Create Your First Channel

After signing up, create a channel via the Supabase dashboard (Table Editor → channels):

```sql
INSERT INTO channels (creator_id, name, slug, subscription_price)
VALUES ('your-user-uuid', 'My Food Channel', 'my-food-channel', 9.99);
```

Or add a POST `/api/channels/create` route to do it via UI.

---

## 7. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For Stripe webhooks in dev, run in a separate terminal:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 8. Key Routes

| Route | Description |
|---|---|
| `/` | Homepage — video discovery feed |
| `/login` | Sign in |
| `/register` | Sign up |
| `/watch/[videoId]` | Video player + paywall |
| `/channel/[username]` | Creator channel page |
| `/studio` | Creator Studio home |
| `/studio/upload` | Upload new video |
| `/studio/videos` | Manage existing videos |
| `/dashboard` | Creator analytics dashboard |

### API Routes
| Route | Description |
|---|---|
| `POST /api/mux/upload` | Create Mux upload URL + video record |
| `POST /api/mux/webhook` | Handle Mux asset events |
| `POST /api/stripe/checkout` | Create Stripe Checkout session |
| `POST /api/stripe/webhook` | Handle Stripe payment/subscription events |
| `GET /auth/callback` | Supabase OAuth redirect handler |

---

## 9. Monetization Models

HapiEats TV supports three models on a per-video basis:

| Model | How It Works |
|---|---|
| **Free** | Anyone can watch |
| **Pay Per View** | Viewer pays once (Stripe one-time payment) |
| **Subscription** | Viewer needs active channel subscription OR platform pass |

**Platform Pass** — a single all-access subscription (set price in Stripe and add the Price ID to env) lets users watch all gated content across all channels.

---

## 10. Deployment (Vercel)

```bash
vercel deploy
```

Set all env vars in Vercel dashboard, then update:
- Supabase redirect URLs to include your production domain
- Mux webhook URL to your production `/api/mux/webhook`
- Stripe webhook URL to your production `/api/stripe/webhook`
- `NEXT_PUBLIC_APP_URL` to your production URL
