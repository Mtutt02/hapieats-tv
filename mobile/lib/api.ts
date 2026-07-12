import { supabase } from './supabase'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hapieatstv.com'

/**
 * Authenticated fetch against the existing Next.js API routes.
 * Sends the Supabase access token as a Bearer header — the web app's
 * lib/supabase/server.ts createClient() accepts it (mobile support patch).
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* empty body */
    }
    const err =
      !res.ok && body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : !res.ok
          ? `Request failed (${res.status})`
          : null
    return { ok: res.ok, status: res.status, data: (body as T) ?? null, error: err }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export const apiGet = <T>(path: string) => api<T>(path)
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) })
