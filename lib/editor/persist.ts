'use client'

// ============================================================
// HapiEats TV Studio — Project Persistence
// Primary: IndexedDB (media blobs + project JSON, offline-safe)
// Secondary: Supabase sync via /api/editor/projects (JSON only)
// ============================================================

import { openDB, type IDBPDatabase } from 'idb'
import type { EditorProject, MediaAsset } from './types'

const DB_NAME = 'hapieats-studio'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('projects')) {
          d.createObjectStore('projects', { keyPath: 'id' })
        }
        if (!d.objectStoreNames.contains('blobs')) {
          d.createObjectStore('blobs')
        }
      },
    })
  }
  return dbPromise
}

/** Persist a media file blob keyed by asset id. */
export async function saveAssetBlob(assetId: string, blob: Blob) {
  const d = await db()
  await d.put('blobs', blob, assetId)
}

export async function getAssetBlob(assetId: string): Promise<Blob | undefined> {
  const d = await db()
  return d.get('blobs', assetId)
}

export async function deleteAssetBlob(assetId: string) {
  const d = await db()
  await d.delete('blobs', assetId)
}

/** Save project JSON locally (object URLs stripped). */
export async function saveProjectLocal(project: EditorProject) {
  const d = await db()
  const clean: EditorProject = {
    ...project,
    assets: project.assets.map(a => ({ ...a, url: '' })),
  }
  await d.put('projects', clean)
}

export async function listProjectsLocal(): Promise<EditorProject[]> {
  const d = await db()
  const all: EditorProject[] = await d.getAll('projects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProjectLocal(id: string) {
  const d = await db()
  const p: EditorProject | undefined = await d.get('projects', id)
  if (p) for (const a of p.assets) await deleteAssetBlob(a.id).catch(() => {})
  await d.delete('projects', id)
}

/** Load a project and rehydrate asset object URLs from stored blobs. */
export async function loadProjectLocal(id: string): Promise<EditorProject | null> {
  const d = await db()
  const p: EditorProject | undefined = await d.get('projects', id)
  if (!p) return null
  const assets: MediaAsset[] = []
  for (const a of p.assets) {
    if (a.remoteUrl) {
      assets.push({ ...a, url: a.remoteUrl })
      continue
    }
    const blob = await getAssetBlob(a.id)
    if (blob) assets.push({ ...a, url: URL.createObjectURL(blob) })
    else assets.push({ ...a, url: '' }) // missing media — clip will render empty
  }
  return { ...p, assets }
}

// ---------------- cloud sync (best-effort) ----------------

export async function syncProjectToCloud(project: EditorProject): Promise<boolean> {
  try {
    const clean = { ...project, assets: project.assets.map(a => ({ ...a, url: '' })) }
    const res = await fetch('/api/editor/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: clean }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function listCloudProjects(): Promise<Array<{ id: string; title: string; updated_at: string }>> {
  try {
    const res = await fetch('/api/editor/projects')
    if (!res.ok) return []
    const { projects } = await res.json()
    return projects || []
  } catch {
    return []
  }
}
