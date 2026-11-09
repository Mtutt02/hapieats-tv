import { describe, it, expect, vi } from 'vitest'
import {
  isStationVideo,
  countByStation,
  withLiveCounts,
  applyStationVideoFilters,
  getStationVideoCounts,
  type StationVideoRow,
} from '@/lib/stations/videos'

const v = (o: Partial<StationVideoRow>): StationVideoRow => ({
  status: 'ready', visibility: 'public', is_clip: false, station_id: 's1', ...o,
})

// Rows for station s1: 3 watchable (one has null is_clip), 4 that must not count.
const fixture: StationVideoRow[] = [
  v({}),
  v({ is_clip: null }),
  v({ is_clip: undefined }),
  v({ is_clip: true }),
  v({ status: 'processing' }),
  v({ visibility: 'private' }),
  v({ visibility: 'unlisted' }),
  v({ station_id: 's2' }),
]

describe('station video rule', () => {
  it('treats null/undefined is_clip as a normal video', () => {
    expect(isStationVideo(v({ is_clip: null }))).toBe(true)
    expect(isStationVideo(v({ is_clip: undefined }))).toBe(true)
  })
  it('excludes clips, non-ready, private and unlisted', () => {
    expect(isStationVideo(v({ is_clip: true }))).toBe(false)
    expect(isStationVideo(v({ status: 'processing' }))).toBe(false)
    expect(isStationVideo(v({ visibility: 'private' }))).toBe(false)
    expect(isStationVideo(v({ visibility: 'unlisted' }))).toBe(false)
  })
  it('counts per station with the same rule', () => {
    const counts = countByStation(fixture)
    expect(counts.get('s1')).toBe(3)
    expect(counts.get('s2')).toBe(1)
  })
  it('live count replaces a stale stored video_count (the #835 bug: stored 0 vs real videos, and the reverse)', () => {
    const out = withLiveCounts(
      [{ id: 's1', video_count: 0 }, { id: 's2', video_count: 99 }, { id: 's3', video_count: 5 }],
      countByStation(fixture),
    )
    expect(out.map(s => s.video_count)).toEqual([3, 1, 0])
  })
})

describe('SQL filters match the predicate', () => {
  // Three-valued SQL semantics: `is_clip <> true` is NULL (row dropped) when is_clip is NULL.
  const oldNeqTrue = (r: StationVideoRow) => r.is_clip !== null && r.is_clip !== undefined && r.is_clip !== true

  it('old `neq is_clip true` dropped null rows, so counts and lists disagreed', () => {
    const old = fixture.filter(r => r.station_id === 's1' && r.status === 'ready' && r.visibility === 'public' && oldNeqTrue(r))
    expect(old.length).toBe(1) // only the is_clip=false row survived; should be 3
  })

  it('applyStationVideoFilters issues ready + public + (null or false) filters', () => {
    const calls: string[] = []
    const q: any = {
      eq: vi.fn((c: string, val: string) => { calls.push(`eq ${c} ${val}`); return q }),
      or: vi.fn((f: string) => { calls.push(`or ${f}`); return q }),
    }
    applyStationVideoFilters(q)
    expect(calls).toEqual(['eq status ready', 'eq visibility public', 'or is_clip.is.null,is_clip.eq.false'])
  })

  it('getStationVideoCounts groups the rows the query returns', async () => {
    const chain: any = {}
    for (const m of ['select', 'not', 'limit', 'eq', 'or']) chain[m] = vi.fn(() => chain)
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: fixture }).then(ok)
    const counts = await getStationVideoCounts({ from: () => chain })
    expect(counts.get('s1')).toBe(3)
  })
})
