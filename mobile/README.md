# HapiEats TV — Mobile App (iOS + Android)

React Native + Expo app for hapieatstv.com. Shares the production Supabase database, Mux video, and the existing Next.js API routes.

## What's included

**Viewer:** email auth, home feed, the TV channel browser (swipe up/down to change channels, OSD, channel guide, same station dial as the web `/tv` page), VOD watch screen with recipe cards / like / "tried this", live stream list with realtime updates, live rooms with realtime chat and token gifting.

**Creator:** studio dashboard (stats + wallet), video upload directly to Mux from the phone library with progress, go-live from the phone camera (RTMP to Mux) or via OBS with a shareable stream key.

**Monetization:** Hapi Token packs and Creator Pro subscription via native in-app purchase (RevenueCat), credited server-side through a webhook. Store-compliant — no Stripe checkout inside the app.

**Push:** Expo push notifications, tokens stored per-user in Supabase.

## One-time setup

### 1. Install

```bash
cd mobile
npm install
npx expo install --fix     # aligns native package versions to the Expo SDK
cp .env.example .env       # fill in real values
```

`.env` values: Supabase URL + anon key (same as web `NEXT_PUBLIC_*`), API URL (`https://hapieatstv.com`), RevenueCat public keys.

### 2. Server-side pieces (already in this repo — deploy the web app once)

- `lib/supabase/server.ts` now accepts `Authorization: Bearer <token>` — this is what lets the mobile app call every existing API route (`/api/live/gift`, `/api/mux/upload`, `/api/livestreams/create`, …). Deploy with `C:\Projects\DEPLOY_HAPIEATS.bat`.
- `app/api/iap/revenuecat-webhook/route.ts` — credits tokens / activates Creator Pro. Add `REVENUECAT_WEBHOOK_SECRET` to Vercel env vars.
- Run the migration `supabase/migrations/20260712_mobile_push_tokens.sql` (`supabase db push`) — creates `push_tokens` and `iap_events`.

### 3. RevenueCat (IAP)

1. Create a RevenueCat project; add iOS + Android apps (bundle id `com.melivate.hapieatstv`).
2. In App Store Connect + Google Play Console create products:
   - Consumables: `hapi_tokens_100`, `hapi_tokens_500`, `hapi_tokens_1200`, `hapi_tokens_2500` (the number in the id **is** the token amount credited — keep the convention).
   - Subscription: `creator_pro_monthly`.
3. In RevenueCat make two Offerings: `tokens` (the packs) and `creator_pro` (the sub).
4. Add a Webhook (Integrations → Webhooks): URL `https://hapieatstv.com/api/iap/revenuecat-webhook`, Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
5. Put the public SDK keys in `.env` / `eas.json`.

Until RevenueCat keys are set, the app runs fine — the token shop just shows a "buy on the website" note.

### 4. EAS (builds + store submission)

```bash
npm i -g eas-cli
eas login                      # Expo account
eas init                       # writes projectId into app.json
eas credentials                # let EAS manage signing for both platforms
```

Add real app icons before submitting: put `icon.png` (1024×1024), `adaptive-icon.png`, and `splash.png` in `mobile/assets/` and restore the `icon` / `splash` / `adaptiveIcon` fields in `app.json`.

## Development

```bash
npx expo start        # Expo Go — everything works EXCEPT go-live camera + IAP (native modules)
npx expo run:ios      # dev build with all native modules (needs a Mac for iOS)
npx expo run:android
```

No Mac? `eas build --profile development --platform ios` builds in the cloud.

## Release

```bash
npm run build:ios && npm run submit:ios
npm run build:android && npm run submit:android
```

iOS needs an Apple Developer account ($99/yr) and an App Store Connect app record; Android needs a Play Console account ($25 one-time). `eas submit` walks through both.

## Store review notes

- Digital goods (tokens, Creator Pro) are IAP-only in-app — compliant with App Store 3.1.1 / Play billing policy. Payouts to creators via Stripe Connect happen on the website, which is allowed.
- Apps with user-generated content need: report + block (already in web chat API — mobile uses the same endpoints), and a moderation story (the daily `ai-moderate` cron + admin tools cover this; mention it in review notes).
- Account deletion is required by both stores: the Profile tab points to the website flow — make sure `hapieatstv.com` settings actually expose deletion before review.
- Provide a demo account in App Review notes (reviewer can't receive email confirmations easily).

## Gotchas

- **Expo Go limitations:** `react-native-purchases` and `@api.video/react-native-livestream` are native — use a dev build.
- **`recipe_cards` table** must exist (web migration `20260701_recipe_cards.sql`).
- **Deploy script:** `DEPLOY_HAPIEATS.bat` copies the repo including `mobile/` — harmless for Vercel (Next.js ignores it), but confirm the script's `node_modules` exclusion also matches `mobile\node_modules`, or push before running `npm install` in `mobile/`.
- Keep `mobile/lib/types.ts` and the station dial in `app/(tabs)/tv.tsx` in sync with the web app.
