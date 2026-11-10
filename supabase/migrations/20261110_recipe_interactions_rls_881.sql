-- #881 / #896: recipe_interactions was created in 0005 with no RLS. With RLS off, the anon and
-- authenticated roles can read and write every user's cooking progress through PostgREST.
-- Owner-only access; service_role bypasses RLS. Idempotent. Not applied to prod (Kennedy-held).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='recipe_interactions') THEN
    EXECUTE 'ALTER TABLE public.recipe_interactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "recipe_interactions_own" ON public.recipe_interactions';
    EXECUTE $p$CREATE POLICY "recipe_interactions_own" ON public.recipe_interactions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)$p$;
    EXECUTE 'REVOKE ALL ON public.recipe_interactions FROM anon';
  END IF;
END $$;
