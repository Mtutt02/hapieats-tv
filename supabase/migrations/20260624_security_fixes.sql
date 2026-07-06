-- ============================================================
-- HapiEats TV — Security & RLS Fixes
-- June 2026
-- ============================================================

-- 1. Protect stream_key from public SELECT
--    The live_streams table has USING(true) select policy which would expose
--    the RTMP ingest key to anyone. Revoke column-level SELECT on stream_key
--    from public roles — service_role (used in API routes) bypasses this automatically.
REVOKE SELECT (stream_key) ON public.live_streams FROM anon, authenticated;

-- 2. Allow authenticated users to submit content reports
--    The content_reports table only had a SELECT policy; INSERT was blocked by RLS.
CREATE POLICY "authenticated_can_report" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 3. Allow service role to insert content reports (server-side reporting routes)
CREATE POLICY "service_role_manages_reports" ON public.content_reports
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Make live_gifts publicly readable for stream viewers
--    The existing policy only allowed sender/creator to read gifts,
--    meaning gift leaderboards were invisible to regular viewers.
--    Live gifts are a public social feature — all stream viewers should see them.
DROP POLICY IF EXISTS "gift_parties_read" ON public.live_gifts;

CREATE POLICY "live_gifts_public_read" ON public.live_gifts
  FOR SELECT USING (true);

-- 5. Allow service role full access to live_gifts (for API inserts)
CREATE POLICY "service_role_manages_live_gifts" ON public.live_gifts
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Allow service role full access to token_balances (for webhook credits)
CREATE POLICY "service_role_manages_token_balances" ON public.token_balances
  FOR ALL USING (auth.role() = 'service_role');

-- 7. Allow service role full access to token_purchases (for webhook records)
CREATE POLICY "service_role_manages_token_purchases" ON public.token_purchases
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Allow service role full access to flavor wallet tables
CREATE POLICY "service_role_manages_flavor_wallets" ON public.flavor_wallets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_manages_flavor_purchases" ON public.flavor_purchases
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_manages_flavor_gift_events" ON public.flavor_gift_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_manages_creator_earnings" ON public.creator_flavor_earnings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_manages_cashout_requests" ON public.flavor_cashout_requests
  FOR ALL USING (auth.role() = 'service_role');
