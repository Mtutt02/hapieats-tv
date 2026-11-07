# HANDOFF — #833 HapiEats TV money fixes

Worktree `G:\work\hapieats-833`, branch `marlowe/p0-833-money`.
Base: `origin/marlowe/p0-834-editor-mux` (9d500a6) fast-forwarded to `origin/agent/otto-834-tests` (6af593d) so vitest + the 15 #834 tests came along.
**Nothing pushed, nothing deployed, nothing run against live Stripe / RevenueCat / Supabase. No env values read or printed.**
All commits authored `ncblackbiz-lang <ncblackbiz@gmail.com>`.

## Commits (one per numbered fix)

| # | sha | what |
|---|---|---|
| 1 | `6b53e72` | Stripe webhook: two-phase event record (`processing`/`completed`, `lease_until`, `attempts`); atomic claim/takeover of stale leases; completed → 200 duplicate, live lease → 409, any other claim error → 500. Every side effect idempotent on its own (`money_effects` keyed by Stripe session/event id; `(buyer,video)`/`(class,user)`/`(course,user)`/`(program,user)` upserts with `ignoreDuplicates`; course counter bumps only on a real insert). Every DB write error now throws (incl. `lib/academy/pro.ts`). Lease is handed back on failure so Stripe's retry runs at once. Also contains the `checkout.session.expired` / `async_payment_failed` handler used by fix 3. |
| 2 | `fa9a480` | RevenueCat webhook: claim → `credit_tokens_once` keyed by RC event id → complete. Old flow logged first and credited second, so a crash between the two skipped every retry as "duplicate" (credit lost), and a failed log insert credited anyway. Claim errors → 500, concurrent → 409, bad/non-uuid `app_user_id` skipped, missing `event.id` → 400, Creator Pro write errors now fail the event. |
| 3 | `1d720ce` | `/api/credits/checkout`: Stripe sessions get a 31-min `expires_at`; webhook restores credits on expired/async-failed via `restore_credits_once` (key = session id → exactly once); a failed session creation, failed PPV unlock or failed full-credit flavor credit restores immediately. Full-credit flavor now uses atomic `credit_flavor_once`. |
| 4 | `53f29c4` | Pro payout: gross = sum of `pro_revenue_ledger` for the month (real paid Pro invoices from `invoice.paid`, minus tax, minus refunds from `charge.refunded`) — no more subscribers × price. `run_pro_payout` locks the pool row and credits every wallet + earnings rows + sets `distributed` in ONE transaction; failure commits nothing; re-run / concurrent run = no-op; unfinished months refused (400). |
| 5 | `fc8a5c1` | Gifts: `send_live_gift` / `send_flavor_gift` SQL RPCs — sender wallet row locked, no negative balance, debit + ledger + gift tx + creator wallet + circle pool in one transaction, deduped per `(sender, request_id)`. Routes call the RPC; web (`LiveRoomClient`, `LiveChat`, `GiftDrawer`) and mobile `GiftSheet` send one request id per tap and reuse it on re-submit. |
| 6 | `7f69e90` | Pause switch: `lib/payments-pause.ts`; `PAYMENTS_PAUSED` / `CREATOR_PAYOUTS_PAUSED` (`1` or `true`) enforced server-side → 503 `{error, paused}`. UI: `GET /api/payments/status`, sitewide strip "Purchases are paused for a short maintenance. Free videos still play.", buy/gift/withdraw buttons disabled. |
| – | (this file) | HANDOFF.md |

## Verification

- `npx tsc --noEmit` → **exit 0** (re-run after commit 6).
- `npx vitest run` → **7 files, 76 tests, all passed** (15 from #834 + 61 new). Baseline before changes: 1 file, 15/15.
  - new: `p0-833-stripe-webhook` 9, `p0-833-revenuecat-webhook` 6, `p0-833-credits-restore` 6, `p0-833-payout` 9, `p0-833-gifts` 9, `p0-833-pause` 22.
- **Fail-on-old check:** for fixes 1–5 I swapped the old route back in (`git show 6af593d:<file>`) and re-ran. Failed on old code: webhook 9/9, RevenueCat 4/6, credits-restore 5/6, payout 6/9, gifts 5/9. The ones that still pass on old code are guard tests (e.g. RC duplicate / lost-response, gift insufficient balance / own stream / ended) and the webhook-ledger tests (new code path). Pause tests can't run on old code (module didn't exist).
- `npm run build` → **FAILS at static prerender, not at compile**: webpack compile OK (only pre-existing supabase Edge-runtime warning), "Checking validity of types" OK, then 17 pages (`/terms`, `/about`, `/register`, `/api/tokens/packs`, …) throw `@supabase/ssr: Your project's URL and API key are required`. Missing env: **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (only `.env.example` exists here). Stopped there per the brief; I did not invent placeholder values. Marlowe: run the build on the iMac / let Vercel build.

## Migration — `supabase/migrations/20261107_money_fixes_833.sql` (NOT applied)

Written to be safe to run once on prod: `IF NOT EXISTS` / `CREATE OR REPLACE` / `ADD COLUMN IF NOT EXISTS`; only two CHECKs are widened (supersets). **Apply BEFORE deploying the code** — the webhooks call the new functions and 500 (Stripe/RC retry) until they exist.

1. `stripe_events` + `iap_events`: `status` (existing rows become `completed`), `lease_until`, `attempts`, `completed_at`; functions `claim_/complete_/release_stripe_event`, `claim_/complete_/release_iap_event`.
2. `money_effects` (effect_key PK); `credit_tokens_once`, `credit_flavor_once`, `repay_loan_once` (effect row + money movement in one transaction). Widens `token_ledger.type` CHECK to add `live_gift` and `iap_purchase` — **the old CHECK never allowed the two types the live-gift and RevenueCat routes wrote**, so those RPCs would have failed on a DB that matches the migrations.
3. `restore_credits_once`; widens `credit_ledger.entry_type` CHECK (+`restore_credit`).
4. `pro_revenue_ledger` (+index), `run_pro_payout`.
5. `live_gift_transactions.request_id`, `flavor_gift_events.request_id` + partial unique indexes; `send_live_gift`, `send_flavor_gift`.
All new functions: `SECURITY DEFINER`, `SET search_path = public`, EXECUTE revoked from PUBLIC/anon/authenticated, granted to `service_role`. New tables have RLS on, no policies (service role only).

## Marlowe — before/at deploy

- **Env vars (Vercel):** `PAYMENTS_PAUSED=1` and/or `CREATOR_PAYOUTS_PAUSED=1` (also accepts `true`). Unset = normal. Env changes need a redeploy to take effect. Webhooks ignore both flags on purpose.
- **Stripe dashboard → webhook endpoint:** add events `checkout.session.expired`, `checkout.session.async_payment_failed`, `invoice.paid` (fix 3 and 4 depend on them; they are not handled until Stripe sends them).
- **Backfill for fix 4:** `pro_revenue_ledger` starts empty, so a payout run for a past month pays **$0** (it will not fall back to the old estimate). If last month should pay out, backfill that month's Pro invoices (one row per paid invoice: id, amount excl. tax, paid_at, month `YYYY-MM`) before running it.
- Review the SQL by eye / run it on a Supabase branch first. See "Not done" #1.

## Not done / caveats (honest list)

1. **SQL was never executed.** No local Postgres and no live services allowed. Tests use an in-memory fake (`tests/helpers/fake-money-db.ts`) whose RPC bodies I hand-mirrored from the SQL, so the route logic is tested but the SQL itself is only reviewed, not run. Highest-value check for ChatGPT/Marlowe: the plpgsql (esp. `claim_stripe_event`'s `ON CONFLICT … WHERE` + `FOUND`, `run_pro_payout`'s `ON CONFLICT … WHERE paid = FALSE` + `FOUND`, named-arg call to `record_token_movement`).
2. `record_token_movement` is defined three times across old migrations; I assumed the latest (`20260703_security_patches.sql`: 8 params, `INSUFFICIENT_BALANCE` raise). `credit_tokens_once` calls it with named args.
3. Unchanged on purpose: `deductCredits` / `grantCredits` / `autoRepayLoanFromCashout` in `lib/credits.ts` (optimistic-lock + separate ledger insert, not one transaction); `/api/flavor/cashout`; challenge votes; refunds for non-token purchases (PPV/courses are not clawed back). Cancel-and-walk-away on a partial-credit checkout holds the credits until the session expires (≤ 31 min).
4. Checkout completed with an async payment method (`payment_status != 'paid'`) is still fulfilled on `checkout.session.completed` as before; card-only checkouts are unaffected.
5. Pause UI: disabled buttons on tokens/flavor shops, PPV/channel-subscribe/platform sub, Pro upgrade wall, gifts (3 web UIs), cashout, creator wallet payout, credit repay. The enroll buttons (class / course / program / academy) are **not** disabled because the same button also does free enrollment; they rely on the sitewide strip + the server's 503 message (their error handling already shows `data.error`). Mobile app has no pause UI (server 503 only; `GiftSheet` shows the error alert). Paid-path pause guards in `academy/programs/[id]/enroll` and `academy/courses/[id]/enroll` are in the code but not covered by a test (`courses/enroll` paid-blocked / free-allowed is).
6. `goals/[id]/contribute` (spends purchased tokens) follows the *payments* pause; I added it as a gift-like spend — say if you'd rather exempt it.
7. Course `enrollment_count` bump is still a separate statement after the enrollment insert (a crash between them loses one count; it can never double count).
8. Git prints CRLF warnings on commit (repo autocrlf); no content impact.
