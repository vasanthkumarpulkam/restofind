import type { GpsLog } from './api'

const KEY = 'restofind_admin_token'

export function getAdminToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setAdminToken(token: string) {
  localStorage.setItem(KEY, token)
}

export function clearAdminToken() {
  localStorage.removeItem(KEY)
}

async function fetchAdminJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = String(data.error)
    } catch {
      // ignore
    }
    const err = new Error(msg)
    ;(err as any).status = res.status
    throw err
  }
  return (await res.json()) as T
}

export async function adminLogin(payload: {
  username: string
  password: string
}): Promise<{ ok: true; token: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return (await res.json()) as { ok: true; token: string }
}

export async function adminFetchLogs(
  token: string,
  params?: { limit?: number; sinceMs?: number; userId?: string },
): Promise<{ ok: true; logs: GpsLog[] }> {
  const url = new URL('/api/admin/logs', window.location.origin)
  if (params?.limit != null) url.searchParams.set('limit', String(params.limit))
  if (params?.sinceMs != null) url.searchParams.set('sinceMs', String(params.sinceMs))
  if (params?.userId) url.searchParams.set('userId', params.userId)
  return fetchAdminJson(url.toString(), token)
}

export async function adminFetchLatestUsers(
  token: string,
): Promise<{ ok: true; users: GpsLog[] }> {
  return fetchAdminJson('/api/admin/users/latest', token)
}

export type AdminAnalytics = {
  rangeDays: number
  sinceMs: number
  pingsByDay: { day: string; count: number }[]
  topCities: { city: string; count: number }[]
  topCuisines: { cuisine: string; count: number }[]
  topRestaurants: { name: string; count: number }[]
}

export async function adminFetchAnalytics(
  token: string,
  rangeDays = 7,
): Promise<{ ok: true; analytics: AdminAnalytics }> {
  const url = new URL('/api/admin/analytics', window.location.origin)
  url.searchParams.set('rangeDays', String(rangeDays))
  return fetchAdminJson(url.toString(), token)
}

export async function adminPurgeLogs(
  token: string,
  days: number,
): Promise<{ ok: true; result: { deleted: number; cutoffMs: number; days: number } }> {
  return fetchAdminJson('/api/admin/purge', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  })
}

export async function adminExportCsv(token: string): Promise<Blob> {
  const res = await fetch('/api/admin/export.csv', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Export failed')
  return await res.blob()
}

