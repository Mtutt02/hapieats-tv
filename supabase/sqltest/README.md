# SQL suite for the #833 money migration (PGlite = real Postgres in WASM)

Not wired into the app's `npm test` (vitest). Install once, then run:

    cd supabase/sqltest && npm i && npm test        # node test.mjs && test3.mjs && test4.mjs

It applies every older migration (Supabase roles/auth/storage stubbed in `bootstrap.sql`, dashboard-made
objects stubbed in `stubs_missing.sql`), then `20261107_money_fixes_833.sql` twice, then asserts.
`test4.mjs` also builds a database that ran the FIRST DRAFT of the migration (`git show 6b53e72:...`) and
re-applies the current one twice. Limits: single connection (no real lock contention), Supabase
`auth.uid()` / PostgREST not modelled. Three old migrations (`004_classes`, `20260711_academy`,
`20260712_rls_hardening`) cannot apply without dashboard-made tables.
