-- ============================================================
-- HapiEats TV — Security RLS Fixes
-- June 2026
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hjvmpltmhxpvrewncnev/sql/new
-- ============================================================

-- ── Fix token_balances: FOR ALL → FOR SELECT for users ────────────────────────
DROP POLICY IF EXISTS "users_own_balance" ON public.token_balances;
DROP POLICY IF EXISTS "users_read_own_balance" ON public.token_balances;
DROP POLICY IF EXISTS "service_role_manages_token_balances" ON public.token_balances;

CREATE POLICY "users_read_own_balance"
  ON public.token_balances FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_manages_token_balances"
  ON public.token_balances FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

-- ── Fix flavor_wallets: FOR ALL → FOR SELECT for users ────────────────────────
DROP POLICY IF EXISTS "flavor_wallets_own" ON public.flavor_wallets;
DROP POLICY IF EXISTS "users_read_own_flavor_wallet" ON public.flavor_wallets;
DROP POLICY IF EXISTS "service_role_manages_flavor_wallets" ON public.flavor_wallets;

CREATE POLICY "users_read_own_flavor_wallet"
  ON public.flavor_wallets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_manages_flavor_wallets"
  ON public.flavor_wallets FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.flavor_wallets ENABLE ROW LEVEL SECURITY;

-- ── Ensure RLS on remaining financial tables ──────────────────────────────────
ALTER TABLE public.token_purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flavor_purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flavor_gift_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_flavor_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flavor_cashout_requests ENABLE ROW LEVEL SECURITY;

SELECT 'Security RLS fixes applied.' AS status;
