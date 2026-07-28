import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Insert a row into `videos`, automatically dropping any column the live
 * database doesn't have yet (schema drift between code and migrations).
 * PostgREST reports unknown columns as PGRST204 ("Could not find the 'x'
 * column…") or Postgres 42703 — both are parsed and the offending column is
 * removed before retrying, so uploads never fail because a migration is
 * pending. Core columns (title, creator_id, mux_upload_id, status) always
 * remain.
 */
export async function insertVideoTolerant(
  client: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string } | { error: string }> {
  const attempt: Record<string, unknown> = { ...row }

  for (let i = 0; i < 10; i++) {
    const { data, error } = await client.from('videos').insert(attempt).select('id').single()
    if (!error && data) return data as { id: string }
    if (!error) return { error: 'Insert returned no data' }

    const msg = error.message ?? ''
    const missing =
      msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/)?.[1] ??
      msg.match(/column (?:videos\.)?"?([a-zA-Z0-9_]+)"? (?:of relation "videos" )?does not exist/)?.[1]

    if ((error.code === 'PGRST204' || error.code === '42703') && missing && missing in attempt) {
      console.warn(`[videos insert] dropping unknown column "${missing}" (migration pending)`)
      delete attempt[missing]
      continue
    }
    console.error('[videos insert] failed:', error)
    return { error: error.message || 'Failed to create video record' }
  }
  return { error: 'Failed to create video record' }
}
