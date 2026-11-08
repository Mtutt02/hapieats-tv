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

---

# ROUND 3 — clearing ChatGPT's BLOCK on PR #5 (2026-11-07)

Review: `G:\work\833-chatgpt-review.md`. Same limits as above: **nothing pushed, nothing deployed, no live Stripe / RevenueCat / Supabase, no env values read.** No charge, refund, payout or transfer was created. Payments stay paused.
Commits are authored `ncblackbiz-lang <ncblackbiz@gmail.com>`; range `72fe741..HEAD`.

## What changed, per review finding number

| # | status | commit | change |
|---|---|---|---|
| 1 | FIXED | `501f2d1` | Migration §6: `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role; ALTER FUNCTION … SET search_path = public, pg_temp` for `record_token_movement(uuid,text,int,uuid,uuid,uuid,text,jsonb)`, `admin_review_monetization_request(uuid,text,uuid,text)`, `check_monetization_auto_unlock(uuid)`, `ensure_token_wallet(uuid)`, `ensure_creator_wallet(uuid)`, `update_creator_streak(uuid,text)`, plus `wallet_add(uuid,int,int)` (re-asserted) and `bump_course_enrollment(uuid)` (was granted to `authenticated`: any user could inflate a course counter). Done in a `to_regprocedure` loop, so a signature missing in some environment is skipped, not fatal. Every app caller of these uses `createServiceClient()` (grepped: enroll, admin/monetization, challenges enter/vote, creator/streak, goals/contribute, live/gift, tokens/wallet, creator/wallet page, tokens page, stripe webhook). Other `SECURITY DEFINER` functions in old migrations are trigger functions (not callable via `/rpc`), read-only (`is_pro_member`) or already revoked (`find_user_id_by_email`, `purge_expired_munchor_link_requests`). |
| 2 | FIXED | `0821c96` (SQL) + `f78ec5e` (route) | `reverse_tokens_for_payment` + `token_reversals`: one row per payment intent, key `stripe:pi:<pi>:token-reversal`. Refund and dispute each keep a *cumulative* token target (refund: `floor(tokenAmount × amount_refunded / amount)`, full when `charge.refunded`; dispute: `dispute.amount / amount`); total reversed = `min(purchased, refund + dispute)`, so refund+dispute on one charge, two partial refunds, and any replay reverse at most what was bought. |
| 3 | FIXED | `f8d4cca` | `checkout.session.completed` fulfils only when `payment_status` is `paid` (or `no_payment_required`, a zero-amount session where nothing is owed); `checkout.session.async_payment_succeeded` runs the same idempotent path; `async_payment_failed` restores credits once. `payment_method_types: ['card']` added to all 16 `checkout.sessions.create` calls (routes + `lib/stripe.ts`). |
| 4 | FIXED | `a59fcde` | Column default of `stripe_events.status` / `iap_events.status` stays `'completed'`; `claim_*` sets `'processing'` explicitly. |
| 5 | FIXED | `2badccf` | `checkoutRef` in session metadata; route and webhook both restore under `credit-checkout:<ref>:restore` (sessions created before this fall back to `stripe:session:<id>:credit-restore`); `sessions.create(..., { idempotencyKey: checkoutRef })`. |
| 6 | FIXED (minimum asked) | `0821c96` + `2badccf` | `money_exceptions` table (RLS on, no policy); a failed credit restore upserts a `credit_restore_failed` row. **Still open:** a crash between the debit and session creation leaves no pending row (no sweeper). Follow-up below. |
| 7 | FIXED | `38e694a` | Payout route returns 409 when `invoicesCounted = 0` and does not flag the month; `run_pro_payout` also returns `no_invoices` without flagging. |
| 8 | FIXED | `38e694a` | `run_pro_payout` raises `BAD_SPLIT` unless `SUM(cents) <= pool_cents <= gross` and every `cents >= 0`. |
| 9 | FIXED (one part unverified live) | `4ec50eb` | `lib/stripe-shapes.ts`: `invoice.subscription` or `parent.subscription_details.subscription`; `subscription_details.metadata` or `parent…metadata`; `invoice.tax` or sum of `total_taxes[].amount`; `charge.invoice` or `invoicePayments.list({payment:{type:'payment_intent',…}})`. Tested with both shapes. The `invoicePayments` call is not in the pinned SDK types, so it is reached through a guarded cast; it has **not** been exercised against real Stripe. |
| 10 | FIXED | `0821c96` + `f78ec5e` | A clawback the buyer cannot cover claws back the available balance and writes/updates a `token_clawback_shortfall` row (deduped, auto-resolved if later recovered); the event completes. `charge.dispute.created` sets `pro_revenue_ledger.disputed_cents` (new column); payout gross = `amount − refunded − disputed` (SQL and route). |
| 11 | DEFERRED | – | See follow-ups. |
| 12 | FIXED | `505b6a2` | `challenges/[id]/vote` returns the 503 for token-spending votes while `PAYMENTS_PAUSED`; free votes still work. |
| 13 | FIXED | `0821c96` + `0f80fa0` | Migration §9: `CREATE UNIQUE INDEX uq_course_enrollments_course_user` only if the table exists and no unique index on exactly (course_id, user_id) exists; failure (duplicates) is a WARNING, not an abort. Webhook counter uses `bump_course_enrollment`. |
| 14 | FIXED | `4ec50eb` | `else if (sub.metadata?.kind !== 'pro_subscription')` on both the updated and deleted branches. |
| 15 | FIXED | `7886250` | Both CHECK swaps are `ADD CONSTRAINT … NOT VALID` then `VALIDATE` inside a `DO` block that logs a WARNING instead of aborting. Header lists the two pre-check selects. |
| 16 | FIXED | `0821c96` | `send_live_gift` requires `status = 'active'`. |
| 17–19 | DEFERRED | – | See follow-ups. |
| 20 | FIXED | `501f2d1` | `SET search_path = public, pg_temp` on every definer function in the migration. |
| 21 | FIXED | `2badccf` | Credits checkout looks up an existing purchase before debiting (returns `already_owned`). |
| 22 | DONE (earlier + now) | – | SQL executed in PGlite (see below). |
| – | | `48e1bcc` | Repairs a few non-UTF-8 em dashes my own earlier edits introduced (no behaviour change). |

Corrections to the caveats above: caveat 3 says challenge votes were unchanged (now paused, #12); caveat 4 (async methods fulfilled on `completed`) is **fixed** (#3); caveat 7 (course counter) is now the atomic RPC.

## Verification

- `npx vitest run` → 12 files, **112 tests passed** (76 before this round + 36 new in `p0-833-round3-*`, plus updates to `payout` test 7 and the pause webhook fixture, which now carries `payment_status`).
- `npx tsc --noEmit` → clean.
- SQL on real Postgres (PGlite, `G:\work\sqltest`): old suite `node test.mjs` **23/23**, new suite `node test3.mjs` **35/35** (migration applied on top of all older ones twice, plus re-runs with legacy-bad data). Details in `G:\work\sqltest\RESULT.md`.

## Production pre-checks (read-only, run BEFORE applying 20261107)

```sql
-- 1. the privilege hole: expect TRUE today, FALSE after the migration (anon too)
select has_function_privilege('authenticated','public.record_token_movement(uuid,text,int,uuid,uuid,uuid,text,jsonb)','execute');
select has_function_privilege('anon','public.record_token_movement(uuid,text,int,uuid,uuid,uuid,text,jsonb)','execute');
select p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'execute') as auth_can
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef order by 1;           -- every definer function that authenticated can call
-- 2. data the CHECK swaps will meet (anything outside the migration's lists leaves that CHECK NOT VALID + a WARNING)
select distinct type       from public.token_ledger;
select distinct entry_type from public.credit_ledger;
-- 3. duplicates that would block the course_enrollments unique index
select course_id, user_id, count(*) from public.course_enrollments group by 1,2 having count(*) > 1;
-- 4. after applying: the migration's own result
select conname, convalidated from pg_constraint where conname in ('token_ledger_type_check','credit_ledger_entry_type_check');
```

**Stripe Dashboard (read-only to check, then a change that needs Kennedy/Marlowe sign-off):**
- Webhook endpoint → **API version** (the payload shape follows this, not the SDK's `2024-06-20`). Round 3 handles both, but note which one it is.
- Enable events on the endpoint: `checkout.session.expired`, `checkout.session.async_payment_failed`, **`checkout.session.async_payment_succeeded`** (new), `invoice.paid`, `charge.refunded`, `charge.dispute.created`, `customer.subscription.*`, `invoice.payment_failed`.
- Payment methods: the code now forces cards on every session it creates; leave any delayed methods off in the Dashboard until the async path has been watched once.

## Before the payout window

- `CREATOR_PAYOUTS_PAUSED=1` stays on until `pro_revenue_ledger` is backfilled.
- **Backfill November before Dec 1** (and any past month that should pay): one row per paid Pro invoice (invoice id, amount excl. tax, paid_at, `YYYY-MM`). The ledger starts empty at deploy; the Dec 1 run for November would otherwise see only invoices paid after the deploy. The route now refuses (409) when the month has no rows, but it cannot detect a *partially* filled month, so verify the November total against Stripe before unpausing.

## Follow-ups (not built, tracked under #833)

- **#11** Non-atomic creator/wallet cashout and credits paths: `app/api/creator/wallet/route.ts` (read `redeemable_cents`, write back — a `wallet_add` between the two is overwritten; concurrent requests both pass the `payout_status` check; write errors ignored), `flavor/cashout`, and `deductCredits` / `grantCredits` / `autoRepayLoanFromCashout` in `lib/credits.ts` (optimistic lock + separate ledger insert). Needs RPCs with row locks like `send_live_gift`.
- **#17** `wallet_add` books Pro-pool payouts under `monthly_earnings.gifts` with 0 tokens (reporting label only).
- **#18** RevenueCat: app-store refunds (`CANCELLATION` / `CUSTOMER_SUPPORT`) never claw tokens back; auth-header compare is not constant-time (`revenuecat-webhook/route.ts:37`); a valid UUID with no profile gets an FK error and is retried forever.
- **#19** `components/PauseStatus.tsx` caches the pause status for the page lifetime (UI only; server enforces).
- **#6 (rest)** Pending-checkout row or debit+pending-row RPC with a sweeper, so a crash between the credit debit and `sessions.create` is recoverable.
- `charge.dispute.closed` (merchant *won*): the dispute no longer reduces the Pro ledger / re-grants nothing; handle it to undo `disputed_cents` (and decide about tokens).
- `update_creator_streak` (pre-existing): `column reference "current_streak" is ambiguous` when run on Postgres (RETURNS TABLE column clashes with a table column). Found while testing privileges; not touched (not money-moving by itself, but the streak route that grants bonus tokens depends on it). Needs `#variable_conflict use_column` or qualified columns.
- Prod has dashboard-made objects that no migration creates (`course_enrollments`, `course_lessons`, …): a fresh DB cannot be built from `supabase/migrations` alone.
