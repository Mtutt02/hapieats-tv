-- ============================================================
-- Security Hardening Migration — 2026-07-01
-- Restricts sensitive column visibility and self-promotion risks
-- ============================================================

-- 1. Revoke public visibility of billing/subscription columns on profiles
--    These were readable by any anon/authenticated user via the public SELECT policy
REVOKE SELECT (
  stripe_customer_id,
  platform_subscription_id,
  stripe_connect_id
) ON public.profiles FROM anon, authenticated;

-- 2. Prevent users from self-promoting via direct Supabase client
--    The "Users can update their own profile" RLS policy allows any column.
--    Restrict to only safe display fields by revoking sensitive column writes.
REVOKE UPDATE (
  role,
  is_creator,
  suspended_at,
  suspension_reason,
  stripe_customer_id,
  platform_subscription_id,
  platform_subscription_status,
  stripe_connect_id,
  stripe_connect_status
) ON public.profiles FROM authenticated;

-- Note: service_role (used by server-side API routes) retains full access.
-- The above only restricts direct Supabase client calls from the browser.

-- 3. Drop the exec_sql function if it still exists — it was a one-time setup helper
--    and is a dangerous arbitrary SQL execution backdoor in production.
DROP FUNCTION IF EXISTS public.exec_sql(text);
DROP FUNCTION IF EXISTS public.exec_sql(sql text);

-- 4. Tighten the moderator profile update policy so moderators cannot change role column.
--    Drop the overly-broad policy and replace with a column-restricted one.
DROP POLICY IF EXISTS moderators_suspend_profiles ON public.profiles;

-- Moderators/admins can only update suspension fields, not role or billing fields
CREATE POLICY moderators_suspend_profiles ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('moderator', 'admin', 'superadmin')
    )
  )
  WITH CHECK (
    -- The suspended_at, suspension_reason columns only — role cannot be changed via this policy
    -- because UPDATE privilege on role column is revoked from authenticated above
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('moderator', 'admin', 'superadmin')
    )
  );
