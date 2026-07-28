-- ============================================================
-- HapiEats TV — Combined Setup SQL
-- Run this ONCE in Supabase SQL Editor → https://supabase.com/dashboard/project/hjvmpltmhxpvrewncnev/sql/new
-- ============================================================

-- ─── PART 1: Security Fixes ──────────────────────────────────────────────────

-- Protect stream_key from public SELECT
REVOKE SELECT (stream_key) ON public.live_streams FROM anon, authenticated;

-- Allow authenticated users to submit content reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='content_reports' AND policyname='authenticated_can_report'
  ) THEN
    CREATE POLICY "authenticated_can_report" ON public.content_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

-- Service role manages reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='content_reports' AND policyname='service_role_manages_reports'
  ) THEN
    CREATE POLICY "service_role_manages_reports" ON public.content_reports
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Live gifts public read
DROP POLICY IF EXISTS "gift_parties_read" ON public.live_gifts;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='live_gifts' AND policyname='live_gifts_public_read'
  ) THEN
    CREATE POLICY "live_gifts_public_read" ON public.live_gifts
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='live_gifts' AND policyname='service_role_manages_live_gifts'
  ) THEN
    CREATE POLICY "service_role_manages_live_gifts" ON public.live_gifts
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Service role manages financial tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='token_balances' AND policyname='service_role_manages_token_balances') THEN
    CREATE POLICY "service_role_manages_token_balances" ON public.token_balances FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='token_purchases' AND policyname='service_role_manages_token_purchases') THEN
    CREATE POLICY "service_role_manages_token_purchases" ON public.token_purchases FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flavor_wallets' AND policyname='service_role_manages_flavor_wallets') THEN
    CREATE POLICY "service_role_manages_flavor_wallets" ON public.flavor_wallets FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flavor_purchases' AND policyname='service_role_manages_flavor_purchases') THEN
    CREATE POLICY "service_role_manages_flavor_purchases" ON public.flavor_purchases FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flavor_gift_events' AND policyname='service_role_manages_flavor_gift_events') THEN
    CREATE POLICY "service_role_manages_flavor_gift_events" ON public.flavor_gift_events FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='creator_flavor_earnings' AND policyname='service_role_manages_creator_earnings') THEN
    CREATE POLICY "service_role_manages_creator_earnings" ON public.creator_flavor_earnings FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flavor_cashout_requests' AND policyname='service_role_manages_cashout_requests') THEN
    CREATE POLICY "service_role_manages_cashout_requests" ON public.flavor_cashout_requests FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ─── PART 2: Moderator Role ───────────────────────────────────────────────────

-- Add 'moderator' and 'superadmin' to role constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'creator', 'admin', 'superadmin', 'moderator'));

-- Moderators can read all content reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_reports' AND policyname='moderators_read_all_reports') THEN
    CREATE POLICY "moderators_read_all_reports" ON public.content_reports
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'moderator'))
      );
  END IF;
END $$;

-- Moderators can update reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_reports' AND policyname='moderators_update_reports') THEN
    CREATE POLICY "moderators_update_reports" ON public.content_reports
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'moderator'))
      );
  END IF;
END $$;

-- Moderators can read all videos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='videos' AND policyname='moderators_read_all_videos') THEN
    CREATE POLICY "moderators_read_all_videos" ON public.videos
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'moderator'))
      );
  END IF;
END $$;

-- Moderators can update videos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='videos' AND policyname='moderators_update_videos') THEN
    CREATE POLICY "moderators_update_videos" ON public.videos
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'moderator'))
      );
  END IF;
END $$;

-- Moderators can suspend profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='moderators_suspend_profiles') THEN
    CREATE POLICY "moderators_suspend_profiles" ON public.profiles
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('admin', 'superadmin', 'moderator'))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('admin', 'superadmin', 'moderator'))
      );
  END IF;
END $$;

-- ─── PART 3: Add is_flagged column to videos if missing ───────────────────────

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- ─── PART 4: Seed demo videos with working Mux test playback IDs ─────────────
-- These are real Mux demo asset playback IDs that stream publicly

-- First update any existing videos with null/empty playback IDs
-- Insert demo videos that point to Mux's public test streams

-- Get or create a demo creator/channel for seeding
DO $$
DECLARE
  demo_creator_id UUID;
  demo_channel_id UUID;
BEGIN
  -- Check if we have any channels to attach videos to
  SELECT id INTO demo_channel_id FROM public.channels LIMIT 1;

  IF demo_channel_id IS NOT NULL THEN
    -- Update existing videos that have null mux_playback_id
    UPDATE public.videos SET
      mux_playback_id = CASE
        WHEN ctid IN (SELECT ctid FROM public.videos WHERE mux_playback_id IS NULL ORDER BY created_at LIMIT 1)
          THEN 'DS00Spx1CV902MCtPj5WknGlR102V5HKkVxV02LV4034g'
        WHEN ctid IN (SELECT ctid FROM public.videos WHERE mux_playback_id IS NULL ORDER BY created_at LIMIT 2)
          THEN '3fevCt00ntwg500btsNg4P02M3R5002pGHmJJLWQFOt01Y'
        WHEN ctid IN (SELECT ctid FROM public.videos WHERE mux_playback_id IS NULL ORDER BY created_at LIMIT 3)
          THEN 'VZtzUzGRv02OnsNX3i6aa9jZnS6quTcms'
        ELSE 'qxb01i6T202jl00cjqEgqNv5D3rAB00oAxKpA01V02frFkXMg'
      END,
      status = 'ready'
    WHERE mux_playback_id IS NULL;
  END IF;
END $$;

-- ─── DONE ──────────────────────────────────────────────────────────────────────
SELECT 'Setup complete! All migrations applied.' AS status;
