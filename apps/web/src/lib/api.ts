const API_BASE = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL || '/api'

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
  return (await res.json()) as T
}

export type Place = {
  displayName?: string
  city?: string
  locality?: string
  region?: string
  regionCode?: string
  road?: string
  neighbourhood?: string
  postcode?: string
  country?: string
  countryCode?: string
}

export type LocationPingResponse = {
  id: string
  lat: number
  lng: number
  accuracy?: number
  timestamp: string
  place?: Place
}

export type Restaurant = {
  id: string
  name: string
  category?: 'restaurant' | 'cafe' | 'fast_food'
  cuisine?: string
  rating?: number | null
  isOpen?: boolean | null
  distanceMeters: number
  lat: number
  lng: number
  delivery?: boolean | null
  pickup?: boolean | null
  address?: string
}

export type AdminLog = {
  _id?: string
  deviceId: string
  lat: number
  lng: number
  accuracy?: number
  timestamp: string
  place?: Place
  userAgent?: string
  platform?: string
  createdAt?: string
}

export type AdminAnalytics = {
  since: string
  windowDays: number
  totals: { pings: number; clicks: number }
  dailyPings: { _id: { y: number; m: number; d: number }; count: number }[]
  weeklyPings: { _id: { y: number; w: number }; count: number }[]
  topCities: { _id: string; count: number }[]
  topCuisines: { _id: string; count: number }[]
  topRestaurants: { _id: { id: string; name: string }; count: number }[]
}

export type AdminPurgeResponse = {
  ok: true
  deleted: number
  cutoff: string
}

export async function postLocationPing(body: {
  deviceId: string
  lat: number
  lng: number
  accuracy?: number
  timestamp: string
  userAgent?: string
  platform?: string
}) {
  return apiJson<LocationPingResponse>('/location/ping', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getNearbyRestaurants(params: {
  lat: number
  lng: number
  radiusMeters?: number
  placeType?: 'any' | 'restaurant' | 'cafe' | 'fast_food'
  cuisine?: string
  cuisines?: string[]
  maxDistanceMeters?: number
  minRating?: number
  delivery?: boolean
  pickup?: boolean
}) {
  const url = new URL(`${API_BASE}/restaurants/nearby`, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return
    if (k === 'cuisines' && Array.isArray(v)) {
      if (!v.length) return
      url.searchParams.set('cuisines', v.join(','))
      return
    }
    url.searchParams.set(k, String(v))
  })

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as { restaurants: Restaurant[] }
}

export async function postRestaurantClick(body: {
  deviceId: string
  restaurantId: string
  name: string
  cuisine?: string
  timestamp: string
}) {
  return apiJson<{ ok: true }>('/restaurants/click', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function adminLogin(body: { username: string; password: string }) {
  return apiJson<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function adminHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  }
}

export async function adminGetLogs(token: string, limit = 200) {
  const url = new URL(`${API_BASE}/admin/logs`, window.location.origin)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), { headers: { ...adminHeaders(token), accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as { logs: AdminLog[] }
}

export async function adminGetAnalytics(token: string, days = 30) {
  const url = new URL(`${API_BASE}/admin/analytics`, window.location.origin)
  url.searchParams.set('days', String(days))

  const res = await fetch(url.toString(), { headers: { ...adminHeaders(token), accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as AdminAnalytics
}

export async function adminPurgeLogs(token: string, days = 30) {
  const url = new URL(`${API_BASE}/admin/logs/purge`, window.location.origin)
  url.searchParams.set('days', String(days))

  const res = await fetch(url.toString(), { method: 'DELETE', headers: { ...adminHeaders(token), accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as AdminPurgeResponse
}

export async function adminDownloadCsv(token: string) {
  const url = new URL(`${API_BASE}/admin/logs.csv`, window.location.origin)
  const res = await fetch(url.toString(), { headers: { ...adminHeaders(token) } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'location-logs.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
