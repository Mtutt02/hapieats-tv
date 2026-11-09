// One definition of "a video that belongs in a station", shared by the Stations list
// (counts), station pages (lists), Global Foods and the TV dial so they cannot disagree.
// Rule: ready + public + not a clip. A null/undefined is_clip is a normal video.

export interface StationVideoRow {
  status?: string | null
  visibility?: string | null
  is_clip?: boolean | null
  station_id?: string | null
}

export function isStationVideo(v: StationVideoRow): boolean {
  return v.status === 'ready' && v.visibility === 'public' && v.is_clip !== true
}

/** Same rule as isStationVideo, as PostgREST filters. (`neq is_clip true` would drop null rows.) */
export function applyStationVideoFilters<T>(query: T): T {
  // Loosely typed on purpose: Supabase's builder generics blow up tsc if constrained here.
  return (query as any)
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .or('is_clip.is.null,is_clip.eq.false') as T
}

export function countByStation(rows: StationVideoRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.station_id || !isStationVideo(r)) continue
    counts.set(r.station_id, (counts.get(r.station_id) ?? 0) + 1)
  }
  return counts
}

/** Replace the stored (stale) video_count with the live count. */
export function withLiveCounts<S extends { id: string; video_count?: number | null }>(
  stations: S[],
  counts: Map<string, number>,
): (S & { video_count: number })[] {
  return stations.map(s => ({ ...s, video_count: counts.get(s.id) ?? 0 }))
}

// Minimal structural type for the Supabase client so this stays unit-testable.
type Db = { from(table: string): any }

export async function getStationVideoCounts(db: Db): Promise<Map<string, number>> {
  const { data } = await applyStationVideoFilters(
    db.from('videos').select('station_id, status, visibility, is_clip').not('station_id', 'is', null).limit(10000),
  )
  return countByStation((data ?? []) as StationVideoRow[])
}

export async function getStationVideoCount(db: Db, stationId: string): Promise<number> {
  const { count } = await applyStationVideoFilters(
    db.from('videos').select('id', { count: 'exact', head: true }).eq('station_id', stationId),
  )
  return count ?? 0
}

export async function getStationVideos<T = unknown>(
  db: Db,
  stationId: string,
  columns: string,
  limit: number,
): Promise<{ videos: T[]; failed: boolean }> {
  const { data, error } = await applyStationVideoFilters(
    db.from('videos').select(columns).eq('station_id', stationId).order('created_at', { ascending: false }).limit(limit),
  )
  return { videos: (data ?? []) as T[], failed: !!error }
}
