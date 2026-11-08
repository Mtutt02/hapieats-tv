import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeService, fakeSession, queryChain } from './helpers/fake-supabase'

// P0 #834: Studio project ownership + Mux upload abuse. All Supabase and Mux calls are mocked;
// nothing here touches a network, a database or a secret.

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  uploadsRetrieve: vi.fn(),
  uploadsCreate: vi.fn(),
  playbackIdsRetrieve: vi.fn(),
  assetsRetrieve: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('@/lib/mux', () => ({
  video: {
    uploads: { retrieve: mocks.uploadsRetrieve, create: mocks.uploadsCreate },
    playbackIds: { retrieve: mocks.playbackIdsRetrieve },
    assets: { retrieve: mocks.assetsRetrieve },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))

import { POST as saveProject } from '@/app/api/editor/projects/route'
import { POST as editorSave } from '@/app/api/mux/editor-save/route'
import { POST as muxImport } from '@/app/api/mux/import/route'
import { GET as directUpload } from '@/app/api/mux/direct-upload/route'

const ALICE = 'user-alice'
const BOB = 'user-bob'

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('POST /api/editor/projects — ownership', () => {
  const project = { id: 'proj-1', title: 'My edit', clips: [] }

  it('(1) cross-account overwrite of an existing project id returns 404 and never writes', async () => {
    // Bob owns proj-1. Alice's UPDATE (scoped to her user_id) matches 0 rows; her INSERT hits the PK.
    const update = queryChain({ data: [] })
    const insert = queryChain({ error: { code: '23505', message: 'duplicate key' } })
    // editor_projects is written through the caller's session client (RLS applies), never the service role.
    mocks.createClient.mockReturnValue(fakeSession(ALICE, [update, insert]))

    const res = await saveProject(post('/api/editor/projects', { project }))

    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Project not found' })
    // The update is scoped to the caller: both id and user_id filters are applied.
    expect(update.eq).toHaveBeenCalledWith('id', 'proj-1')
    expect(update.eq).toHaveBeenCalledWith('user_id', ALICE)
    // The insert can only ever create a row owned by the caller.
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'proj-1', user_id: ALICE }))
  })

  it('owner updates their own project (200, no insert attempted)', async () => {
    const update = queryChain({ data: [{ id: 'proj-1' }] })
    mocks.createClient.mockReturnValue(fakeSession(ALICE, [update]))

    const res = await saveProject(post('/api/editor/projects', { project }))

    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(update.eq).toHaveBeenCalledWith('user_id', ALICE)
  })

  it('a brand-new project id is inserted for the caller (200)', async () => {
    const update = queryChain({ data: [] })
    const insert = queryChain({})
    mocks.createClient.mockReturnValue(fakeSession(BOB, [update, insert]))

    const res = await saveProject(post('/api/editor/projects', { project }))

    expect(res.status).toBe(200)
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'proj-1', user_id: BOB }))
  })

  it('anonymous caller gets 401 before any database access', async () => {
    mocks.createClient.mockReturnValue(fakeSession(null))
    mocks.createServiceClient.mockReturnValue(fakeService({}))

    const res = await saveProject(post('/api/editor/projects', { project }))

    expect(res.status).toBe(401)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })
})

describe('POST /api/mux/editor-save — upload binding, dedupe, quota', () => {
  const body = { uploadId: 'upload-1', title: 'Pasta night' }
  const mine = { new_asset_settings: { passthrough: `hapi-uploader:${ALICE}` } }

  it('(2) an upload id issued to another account returns 404 and writes nothing', async () => {
    mocks.uploadsRetrieve.mockResolvedValue({ new_asset_settings: { passthrough: `hapi-uploader:${BOB}` } })
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const service = fakeService({}) // any videos query would throw
    mocks.createServiceClient.mockReturnValue(service)

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(404)
    expect(service.from).not.toHaveBeenCalled()
  })

  it('(2b) an upload with no passthrough (issued before this fix) returns 404', async () => {
    mocks.uploadsRetrieve.mockResolvedValue({ new_asset_settings: {} })
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.createServiceClient.mockReturnValue(fakeService({}))

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(404)
  })

  it('(2c) a Mux lookup failure is treated as "not yours" (404), not a crash', async () => {
    mocks.uploadsRetrieve.mockRejectedValue(new Error('mux down'))
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.createServiceClient.mockReturnValue(fakeService({}))

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(404)
  })

  it('(3) saving an upload id that is already a video returns 409 and inserts nothing', async () => {
    mocks.uploadsRetrieve.mockResolvedValue(mine)
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const existing = queryChain({ data: { id: 'video-existing' } })
    mocks.createServiceClient.mockReturnValue(fakeService({ videos: [existing] }))

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(409)
    expect(existing.eq).toHaveBeenCalledWith('mux_upload_id', 'upload-1')
  })

  it('(4) a creator at the daily quota gets 429 and inserts nothing', async () => {
    mocks.uploadsRetrieve.mockResolvedValue(mine)
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const noDuplicate = queryChain({ data: null })
    const count = queryChain({ count: 25 })
    mocks.createServiceClient.mockReturnValue(fakeService({ videos: [noDuplicate, count] }))

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(429)
    expect(count.eq).toHaveBeenCalledWith('creator_id', ALICE)
  })

  it('a creator one under the quota still saves (200)', async () => {
    mocks.uploadsRetrieve.mockResolvedValue(mine)
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const noDuplicate = queryChain({ data: null })
    const count = queryChain({ count: 24 })
    const insert = queryChain({ data: { id: 'video-new' } })
    mocks.createServiceClient.mockReturnValue(fakeService({ videos: [noDuplicate, count, insert] }))

    const res = await editorSave(post('/api/mux/editor-save', body))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ videoId: 'video-new' })
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: ALICE, mux_upload_id: 'upload-1' }),
    )
  })
})

describe('POST /api/mux/import — playbackId ownership and duplicates', () => {
  const body = { playbackId: 'playback-1', title: 'Re-import' }

  beforeEach(() => {
    // By default the playback ID resolves to an asset that ALICE uploaded through direct-upload.
    mocks.playbackIdsRetrieve.mockResolvedValue({ id: 'playback-1', object: { id: 'asset-1', type: 'asset' } })
    mocks.assetsRetrieve.mockResolvedValue({ id: 'asset-1', passthrough: `hapi-uploader:${ALICE}` })
  })

  it('(5b) a playbackId whose asset belongs to another account returns 404 and touches no table', async () => {
    mocks.assetsRetrieve.mockResolvedValue({ id: 'asset-1', passthrough: `hapi-uploader:${BOB}` })
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const service = fakeService({})
    mocks.createServiceClient.mockReturnValue(service)

    const res = await muxImport(post('/api/mux/import', body))

    expect(res.status).toBe(404)
    expect(service.from).not.toHaveBeenCalled()
  })

  it('(5c) a playbackId with no passthrough (not created by this app) returns 404', async () => {
    mocks.assetsRetrieve.mockResolvedValue({ id: 'asset-1' })
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.createServiceClient.mockReturnValue(fakeService({}))

    const res = await muxImport(post('/api/mux/import', body))

    expect(res.status).toBe(404)
  })

  it('(5d) a live-stream playback ID, or a Mux lookup failure, returns 404', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.createServiceClient.mockReturnValue(fakeService({}))

    mocks.playbackIdsRetrieve.mockResolvedValue({ id: 'playback-1', object: { id: 'ls-1', type: 'live_stream' } })
    expect((await muxImport(post('/api/mux/import', body))).status).toBe(404)

    mocks.playbackIdsRetrieve.mockRejectedValue(new Error('mux down'))
    expect((await muxImport(post('/api/mux/import', body))).status).toBe(404)
  })

  it('(5) a playbackId already on a video returns 409 and inserts nothing', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const existing = queryChain({ data: { id: 'video-existing' } })
    mocks.createServiceClient.mockReturnValue(fakeService({ videos: [existing] })) // 2nd videos query would throw

    const res = await muxImport(post('/api/mux/import', body))

    expect(res.status).toBe(409)
    expect(existing.eq).toHaveBeenCalledWith('mux_playback_id', 'playback-1')
  })

  it('a new playbackId imports for the caller (200)', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    const noDuplicate = queryChain({ data: null })
    const insert = queryChain({ data: { id: 'video-new' } })
    mocks.createServiceClient.mockReturnValue(fakeService({ videos: [noDuplicate, insert] }))

    const res = await muxImport(post('/api/mux/import', body))

    expect(res.status).toBe(200)
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: ALICE, mux_playback_id: 'playback-1' }),
    )
  })
})

describe('GET /api/mux/direct-upload — binding and rate limit', () => {
  beforeEach(() => {
    vi.stubEnv('MUX_TOKEN_ID', 'test-token-id-1234567890')
  })

  it('binds the new upload to the caller via passthrough and records it in the ledger', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.checkRateLimit.mockReturnValue({ allowed: true })
    mocks.uploadsCreate.mockResolvedValue({ url: 'https://mux.example/upload', id: 'upload-1' })
    const count = queryChain({ count: 0 })
    const record = queryChain({})
    mocks.createServiceClient.mockReturnValue(fakeService({ mux_upload_requests: [count, record] }))

    const res = await directUpload(new NextRequest('http://localhost/api/mux/direct-upload'))

    expect(res.status).toBe(200)
    expect(record.insert).toHaveBeenCalledWith({ upload_id: 'upload-1', user_id: ALICE })
    expect(mocks.uploadsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        new_asset_settings: expect.objectContaining({ passthrough: `hapi-uploader:${ALICE}` }),
      }),
    )
  })

  it('over the hourly limit returns 429 and creates no Mux upload', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.checkRateLimit.mockReturnValue({ allowed: false })

    const res = await directUpload(new NextRequest('http://localhost/api/mux/direct-upload'))

    expect(res.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(`${ALICE}:mux-direct-upload`, 20, 60 * 60_000)
    expect(mocks.uploadsCreate).not.toHaveBeenCalled()
  })

  it('(6) at the database-backed hourly quota (any instance) returns 429 and creates no Mux upload', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.checkRateLimit.mockReturnValue({ allowed: true }) // this instance has not seen the traffic
    const count = queryChain({ count: 20 })
    mocks.createServiceClient.mockReturnValue(fakeService({ mux_upload_requests: [count] }))

    const res = await directUpload(new NextRequest('http://localhost/api/mux/direct-upload'))

    expect(res.status).toBe(429)
    expect(count.eq).toHaveBeenCalledWith('user_id', ALICE)
    expect(mocks.uploadsCreate).not.toHaveBeenCalled()
  })

  it('(6b) with the ledger table missing (migration not applied) uploads still work', async () => {
    mocks.createClient.mockReturnValue(fakeSession(ALICE))
    mocks.checkRateLimit.mockReturnValue({ allowed: true })
    mocks.uploadsCreate.mockResolvedValue({ url: 'https://mux.example/upload', id: 'upload-2' })
    const missing = { error: { code: '42P01', message: 'relation does not exist' } }
    mocks.createServiceClient.mockReturnValue(
      fakeService({ mux_upload_requests: [queryChain(missing), queryChain(missing)] }),
    )

    const res = await directUpload(new NextRequest('http://localhost/api/mux/direct-upload'))

    expect(res.status).toBe(200)
  })

  it('anonymous caller gets 401', async () => {
    mocks.createClient.mockReturnValue(fakeSession(null))

    const res = await directUpload(new NextRequest('http://localhost/api/mux/direct-upload'))

    expect(res.status).toBe(401)
    expect(mocks.uploadsCreate).not.toHaveBeenCalled()
  })
})
