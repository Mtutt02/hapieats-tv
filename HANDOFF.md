# HANDOFF #835: Stations counts + honest render UI

Branch `marlowe/p1-835-stations`, based on PR #4 head `5e86791`. Not pushed.

## Cause
- `/stations` showed the stored `stations.video_count`, which no code or migration updates.
- Station page and Global Foods used `.neq('is_clip', true)`, which in SQL drops rows where `is_clip` is NULL. The TV page used `.eq('is_clip', false)`, same problem. Three places, three rules.

## What changed
- `lib/stations/videos.ts` (new): one rule (ready + public + `is_clip` not true; null = normal video), as predicate and as PostgREST filters, plus live count/list helpers.
- `app/stations/page.tsx`: counts come from the helper (live), not the stored column.
- `app/stations/[slug]/page.tsx`: list and header count both use the helper; empty state copy is plain, and a failed query shows "Couldn't load videos right now" instead of a false "No videos".
- `app/global-foods/page.tsx`, `app/tv/page.tsx`: use the same filters.
- `app/api/studio/render/route.ts`: now 503 with `code: 'render_offline'` (was HTTP 200 with success:false).
- `components/studio/HapieatsTVEditor.tsx`: inline "Rendering is offline right now, try again later." instead of `alert()`; guards double-submit; spinner always clears (`finally`). This component is not imported anywhere today. The live Studio export (`ExportDialog`, in-browser) was left alone: it really renders.
- `tests/p1-835-stations.test.ts`: fixture rows (null is_clip, clips, non-ready, private, unlisted), filter calls, old-vs-new SQL semantics, render route 503. Before the change the helper module did not exist, so the test could not pass.
- `DESIGN-835.md`: people-first note.
- No money/auth/migration files touched. `video_count` column left in place (unused by these pages).

## Verification
- `npx vitest run`: 2 files, 28 tests passed. `npx tsc --noEmit`: clean.
- Lint: not run, `next lint` has no ESLint config (it prompts).
- node_modules is a junction to G:\work\hapieats-833\node_modules.

## NOT verified
- Live data: no Supabase env, so the seven station pages were not checked against real rows.
- No Playwright/screenshots at 390px or light/dark: the app was not run. Edits add no new colors/layout.
- Preview/production deploy not touched.
- Station count query reads up to 10,000 video rows per request (revalidate 60s). Fine now; move to a SQL view/RPC if the catalog grows. Videos with no `station_id` are not counted anywhere (TV dial maps them to `general`; the list page does not).

## Open the PR from the iMac
```
git fetch origin
git fetch <this PC share or bundle> marlowe/p1-835-stations   # or copy the branch over
git push origin marlowe/p1-835-stations
gh pr create --base <PR #4 head branch> --head marlowe/p1-835-stations
```
Base must be PR #4's branch (head `5e86791`), not `main`, so the diff shows only these 3 commits.
