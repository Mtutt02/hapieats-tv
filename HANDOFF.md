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

---

# ROUND 4 — fix list from the round-3 re-review (2026-11-08)

Branch `marlowe/p0-833-money`, base `a63ebc0`. Worked on the iMac in `~/code/hapieats-833-r4` (worktree of `hapieats-tv-marlowe`).
Approved scope only: code, tests, SQL edits, push of the feature branch. **Not done, on purpose:** no merge, no migration applied anywhere, no REVOKE/GRANT on a live DB, no deploy, no Stripe Dashboard change, no real charge or refund, no env value read or printed. `PAYMENTS_PAUSED=1` and `CREATOR_PAYOUTS_PAUSED=1` are untouched.
New dependencies: **none** in the app (`supabase/sqltest/` has its own `package.json` with `@electric-sql/pglite`; it is not part of the app build or of `npm test`).

## Per-item status

| # | item | status | covered by |
|---|---|---|---|
| 1 | **N2** `current_period_end` undefined on basil (RangeError, event retried forever) | **FIXED** | `currentPeriodEnd/Start(sub)` in `lib/stripe-shapes.ts` read `sub.current_period_end ?? sub.items.data[0].current_period_end`, else `null`. Used by the webhook (channel subscription) and by both reads in `lib/academy/pro.ts` (start AND end). If neither exists the column is **left out of the write** instead of written as `null`, so a good stored value is never wiped; a brand-new row gets the column default (NULL). Tests: `round4-webhook` "N2" (6): helpers, basil item-level, pre-basil, neither shape (200, existing value kept), new row, Pro handlers. `types/index.ts:80` is a type only. |
| 2 | **N1 + F9** basil charges don't name their invoice, so refunds/disputes never reduced `pro_revenue_ledger` | **FIXED** (code + SQL + tests); live Stripe behaviour **NOT VERIFIED** (below) | (a) `pro_revenue_ledger.stripe_payment_intent_id TEXT` + partial unique index `uq_pro_revenue_ledger_payment_intent`; filled at `invoice.paid` from `invoice.payment_intent` (old) or `invoice.payments[]` (basil, only present if expanded), else one InvoicePayments lookup (failure is logged, the revenue row is still written). (b) `charge.refunded` / `charge.dispute.created` match `charge.invoice` first, then `stripe_payment_intent_id = charge.payment_intent`. (c) last resort: InvoicePayments lookup by payment intent; if it throws, the event still completes so the token clawback runs. No match = no-op. Tests: `round4-webhook` "N1" (12): old-shape charge by invoice, basil charge by PI (no API call), basil dispute by PI, last-resort lookup, unmatched charge no-op, lookup throws, replay, invoice.paid stamps PI in 4 shapes. SQL: test4 (column, partial unique, find-by-PI). |
| 3 | **N3** paid challenge votes can double-charge | **FIXED**; real lock contention **NOT VERIFIED** | `cast_paid_vote(p_user_id, p_challenge_id, p_entry_id, p_cost)` SECURITY DEFINER, `search_path = public, pg_temp`, REVOKE PUBLIC/anon/authenticated, GRANT service_role: locks the `hapi_tokens` row `FOR UPDATE`, inserts the vote under the existing unique key `(entry_id, voter_id)` (`ON CONFLICT DO NOTHING`), debits via `record_token_movement` only if the insert happened; insufficient balance raises and rolls the vote back. Also re-checks entry approved / challenge in voting / not your own entry. Route calls it; duplicate = 200 `{duplicate:true, tokens_spent:0}`; free duplicate vote no longer 500s. Tests: `round4-credits-vote` "N3" (6): two concurrent votes = 1 vote + 1 debit, retry, separate entries, 402, RPC failure leaves nothing, free duplicate. SQL: test4 "N3" (7). PGlite has one connection, so true concurrent locking is argued from the SQL, not exercised; the JS test uses a fake whose RPC body is atomic. |
| 4 | **S1** first-draft DB keeps `status DEFAULT 'processing'`; `disputed_cents` has no CHECK | **FIXED** | `ALTER COLUMN status SET DEFAULT 'completed'` on `stripe_events` and `iap_events`; `disputed_cents >= 0` CHECK added by name inside a `DO` block guarded by `pg_constraint` (`NOT VALID` then `VALIDATE`, a failure is a WARNING). **Extra (not asked, needed for the same case):** rows the OLD webhook wrote while the first-draft default was live are `processing` with `lease_until IS NULL AND attempts = 0` (the new claim always sets attempts >= 1 and a lease); the migration marks exactly those `completed`, otherwise the new claim would treat them as a crashed delivery and re-fulfil them. Tests: SQL test4 on a DB that applied the **real first draft** (`git show 6b53e72:…`), then the new migration twice: defaults, repaired rows, a genuine in-flight claim left alone, CHECK exists once and rejects `-1`. |
| 5 | **S2** owned-check + debit race in `/api/credits/checkout` (+ #6 sweeper follow-up) | **FIXED** (PPV); sweeper function exists but is **not scheduled** | `pending_credit_checkouts (buyer_id, video_id)` primary key. Route order: owned check (`.limit(1)`, no more `maybeSingle()` 500 on duplicate purchase rows) -> `peek_credit_checkout` (live claim = 409 + the Stripe URL; an EXPIRED claim is settled first, which matters because after a crash the buyer has 0 credits) -> `claim_credit_checkout` (second claimant gets 409) -> owned **re-check inside the claim** -> debit (a failed debit releases the claim) -> unlock / Stripe session. Released on: full-credit unlock, route restore, webhook `expired`/`async_payment_failed` restore, webhook `completed` for `credit_ppv`. An expired claim is settled by `settle_credit_checkout`: credits restored under the SAME key `credit-checkout:<ref>:restore` (so route/webhook/sweeper can never restore twice), **only** if the ledger shows a spend since the claim and the video is not owned. `sweep_stale_credit_checkouts(limit)` settles all expired rows. Tests: `round4-credits-vote` "S2" (10): two concurrent partial = 1 debit + 1 session + 409, second tap gets the URL, concurrent full-credit, pay then retry = already_owned, expiry restores + frees, session create fails, debit fails, duplicate purchase rows, purchase lands between check and claim, crashed attempt settled once. SQL: test4 "S2" (11). **Flavor mode is not covered** (no "owned" concept; a crash between debit and session still has no pending row). |
| 6 | **S3** `charge.dispute.closed`, merchant won | **FIXED** | Status `won` only: `pro_revenue_ledger.disputed_cents = 0` (same matching as item 2) and `dispute_won_for_payment` sets `token_reversals.dispute_tokens = 0`; tokens are **not** re-credited; if tokens had been clawed back a `money_exceptions` row `dispute_won_review` (deduped `dispute-won:<key>`, amount = tokens reversed) is written for a human. Lost/other statuses change nothing. Idempotent. Event added to the endpoint list below. Tests: `round4-webhook` "S3" (5) and SQL test4 "S3" (5). Known edge: `reversed` stays counted, so a refund that arrives AFTER a won dispute is topped up against what was already clawed back; and a `closed` that is processed before its `created` would be overwritten by the later `created` (Stripe sends them days apart, not handled). |
| 7a | **F11** atomic RPCs for creator/wallet cashout, flavor/cashout, `lib/credits.ts` deduct/grant/autoRepay | **DEFERRED** (not started) | Needs its own design pass and RPCs with row locks like `send_live_gift`. |
| 7b | **F18** RevenueCat refund clawback | **FIXED**; live payload **NOT VERIFIED** | `CANCELLATION` with `cancel_reason = CUSTOMER_SUPPORT` on a `hapi_tokens_<n>` product calls `reverse_tokens_for_payment` keyed `rc:<transaction_id>` (cap, partial + `money_exceptions` shortfall, replay-safe). No transaction id = 500 (RevenueCat retries; no guessed key). Field names follow RevenueCat's documented webhook format; I did not see a real refund event. Tests: `round4-revenuecat` (5). |
| 7c | **F18** constant-time auth compare | **FIXED** | sha256 both sides + `timingSafeEqual`. Test: `round4-revenuecat` (1, five wrong/near-miss/longer/empty secrets). |
| 7d | **F18** missing profile retried forever | **FIXED** | FK violation (`23503`) from the credit/clawback RPC is written to `money_exceptions` (`iap_unknown_user`, dedupe `iap-unknown-user:<event id>`), the event is completed and acknowledged (200). Any other DB error stays a 500. Tests: `round4-revenuecat` (2). |
| 7e | `update_creator_streak` ambiguous `current_streak` | **FIXED** | `#variable_conflict use_column`, same body, `search_path` pinned, ACL re-asserted (migration §13). SQL test4 (3): runs, same-day twice, day-after extends to 7 with milestone `'7'`, still not callable by anon/authenticated. |

## What is NOT VERIFIED (be honest)

1. **Basil behaviour against real Stripe.** Nothing here ran against Stripe. Assumptions: the `invoice.paid` event body does **not** carry `payments` unless expanded; `GET /v1/invoice_payments?invoice=…` and `?payment[type]=payment_intent&payment[payment_intent]=…` return `data[].invoice` / `data[].payment.payment_intent` / `status`; `Stripe-Version: 2025-03-31.basil` is accepted per request.
2. **The pinned SDK cannot do the lookup by itself.** `stripe@16.12.0` (package-lock) has no `rawRequest` and no `invoicePayments` resource. `lib/stripe-shapes.ts` therefore tries `rawRequest`, then `invoicePayments.list`, then a plain `fetch` to `api.stripe.com` with `STRIPE_SECRET_KEY` and the `Stripe-Version` header (read-only GET). On the pinned SDK it is the `fetch` path that runs. Unit tests exercise the SDK-resource path through a mock; the `fetch` path has **no automated test** and was never run. If you want it gone: bump `stripe` to a version with `rawRequest`, or pin the endpoint to a basil API version and the primary PI stamp covers everything except the one lookup at `invoice.paid` time.
3. Real lock contention (items 3 and 5): single-connection PGlite only.
4. The RevenueCat refund payload (item 7b).
5. `npm run build` was **not** run (needs the Supabase env vars; unchanged from round 3).

## Verification (run on the iMac, 2026-11-08)

- `npx tsc --noEmit` -> **exit 0**.
- `npx vitest run` -> **Test Files 15 passed (15), Tests 159 passed (159)** (112 before this round; +47 new in 3 files, `p0-833-round4-webhook` 23, `round4-credits-vote` 16, `round4-revenuecat` 8). `vitest.config.ts` now sets `STRIPE_SECRET_KEY=''` for tests so the `fetch` fallback can never fire.
- **Fail-on-old:** the 5 changed source files + `stripe-shapes.ts` swapped back to `a63ebc0` and the 3 new test files re-run: **33 of 47 fail** (the other 14 are guard tests that pass on old code too: old-shape charge, unmatched no-op, lost dispute, free-vote path, non-refund cancellation, bad-secret 401s, etc.). Files restored afterwards.
- SQL suite on real Postgres (PGlite, in memory), run from `supabase/sqltest/` (`npm test`): `test.mjs` **23/23**, `test3.mjs` **35/35**, `test4.mjs` **41/41**.
- **Migration idempotent on a first-draft DB:** `test4.mjs` applies all older migrations, then the first draft (`git show 6b53e72:supabase/migrations/20261107_money_fixes_833.sql`, default `'processing'`, no `disputed_cents`), inserts a bare old-code row and a genuine in-flight claim, then applies the current migration **twice**: both pass, defaults flip to `completed`, the bare row is repaired (claim -> `duplicate`), the in-flight row is untouched, the CHECK exists exactly once. `test.mjs`/`test3.mjs` also apply it twice (and again with legacy-bad data) on top of all older migrations.
- Same harness limits as round 3: 3 old migrations (`004_classes`, `20260711_academy`, `20260712_rls_hardening`) cannot apply in PGlite (dashboard-made tables); `course_enrollments` and `pro_payout_pool`/`pro_pool_earnings` are stubbed.

## Production pre-checks for the new objects (read-only; run BEFORE applying the migration)

```sql
-- 1. nothing with these names exists yet (expect 0 rows / NULL)
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('cast_paid_vote','dispute_won_for_payment','claim_credit_checkout',
   'peek_credit_checkout','settle_credit_checkout','release_credit_checkout','sweep_stale_credit_checkouts');
select to_regclass('public.pending_credit_checkouts');

-- 2. cast_paid_vote needs the unique key (entry_id, voter_id) on challenge_votes (ON CONFLICT target)
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid='public.challenge_votes'::regclass and contype in ('u','p');

-- 3. column types the new functions assume
select table_name, column_name, data_type, is_nullable from information_schema.columns
 where (table_name='purchases'      and column_name in ('buyer_id','video_id','stripe_payment_intent_id','credit_funded'))
    or (table_name='credit_ledger'  and column_name in ('reference_id','reference_type','created_at'))
    or (table_name='pro_revenue_ledger' and column_name in ('stripe_payment_intent_id','disputed_cents'));
--    expect purchases.video_id uuid, credit_ledger.reference_id text, created_at present.
--    ALSO LOOK: purchases.stripe_payment_intent_id was NOT NULL + UNIQUE in 001_initial; the full-credit unlock
--    inserts NULL. If prod still says is_nullable = NO, that unlock fails today (pre-existing, not touched).

-- 4. the new column / index must not exist yet; no payment intent can collide (all rows start NULL)
select indexname from pg_indexes where indexname='uq_pro_revenue_ledger_payment_intent';

-- 5. S1: what the migration will repair
select column_name, column_default from information_schema.columns
 where table_name in ('stripe_events','iap_events') and column_name='status';           -- 'processing' = the first draft ran here
select 'stripe_events' t, count(*) from public.stripe_events where status='processing' and lease_until is null and attempts=0
union all select 'iap_events', count(*) from public.iap_events where status='processing' and lease_until is null and attempts=0;
select count(*) from public.pro_revenue_ledger where disputed_cents < 0;               -- must be 0 (else the CHECK stays NOT VALID + WARNING)

-- 6. update_creator_streak: current definition (the migration replaces it with the same body + #variable_conflict use_column)
select pg_get_functiondef('public.update_creator_streak(uuid,text)'::regprocedure);

-- 7. after applying: the 8 new/changed functions are service_role only (expect all false for authenticated, anon)
select p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'execute') auth_can, has_function_privilege('anon', p.oid, 'execute') anon_can
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('cast_paid_vote','dispute_won_for_payment','claim_credit_checkout','peek_credit_checkout',
   'settle_credit_checkout','release_credit_checkout','sweep_stale_credit_checkouts','update_creator_streak');
```

## Marlowe / Kennedy — before or at deploy (round 4 additions)

- Apply the migration BEFORE the code, as before (the webhook now calls `dispute_won_for_payment`, the routes call `cast_paid_vote`, `peek/claim/release_credit_checkout`; they 500 until the functions exist).
- **Stripe Dashboard -> webhook endpoint -> events** (add `charge.dispute.closed`; full list now): `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, **`charge.dispute.closed`** (new), `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- `STRIPE_SECRET_KEY` must be set in the runtime (already needed everywhere): the basil lookup fallback reads it. Check the endpoint's **API version** in the Dashboard (still the open question from round 3): if it is pre-basil, the PI stamp is simply redundant; if basil, the stamp + lookup are what keeps refunds working.
- **Schedule the sweeper** (not scheduled by this branch): `select public.sweep_stale_credit_checkouts(100);` every 15-30 min (pg_cron or a protected cron route using the service role). Without it a crashed checkout is still settled the next time that buyer touches that video, so it is a clean-up, not a correctness need.
- Backfill reminder from round 3 still applies: old Pro invoices have no `stripe_payment_intent_id`; a refund of one of those falls back to the InvoicePayments lookup.

## REMAINING (not done this round)

- **F11** atomic cashout / wallet / `lib/credits.ts` deduct-grant-autoRepay (optimistic lock + separate ledger insert is still how credits are debited; the new pending row stops the double-debit race for PPV but not a crash between the optimistic update and the ledger insert).
- Flavor partial-credit checkout has no pending row (crash between debit and session creation is unrecoverable there).
- Schedule `sweep_stale_credit_checkouts`.
- `goals/[id]/contribute` pause decision, `components/PauseStatus.tsx` caching, `wallet_add` reporting label (#17, #19) — unchanged from round 3.
- Test for the `fetch` fallback in `lib/stripe-shapes.ts` (needs a network stub) — NOT VERIFIED above.
