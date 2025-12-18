export type Place = {
  placeName: string
  city: string
  locality: string
  road: string
  country: string
}

export type GpsLog = {
  id: number
  userId: string
  lat: number
  lng: number
  accuracyM: number | null
  tsMs: number
  placeName: string
  city: string
  locality: string
  road: string
  country: string
  userAgent: string
}

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  rating: number | null
  openNow: boolean | null
  distanceM: number
  lat: number
  lng: number
  delivery: boolean
  pickup: boolean
  source: 'osm' | 'google'
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = String(data.error)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export async function postLocation(payload: {
  userId: string
  lat: number
  lng: number
  accuracyM: number | null
  tsMs: number
}): Promise<{ ok: true; log: GpsLog; place: Place }> {
  return fetchJson('/api/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      userAgent: navigator.userAgent,
    }),
  })
}

export async function fetchRestaurants(params: {
  lat: number
  lng: number
  radiusM?: number
  limit?: number
}): Promise<{ ok: true; restaurants: Restaurant[] }> {
  const url = new URL('/api/restaurants', window.location.origin)
  url.searchParams.set('lat', String(params.lat))
  url.searchParams.set('lng', String(params.lng))
  if (params.radiusM != null) url.searchParams.set('radiusM', String(params.radiusM))
  if (params.limit != null) url.searchParams.set('limit', String(params.limit))
  return fetchJson(url.toString())
}

export async function trackRestaurantClick(payload: {
  userId: string
  restaurantId: string
  name: string
  cuisine: string
}): Promise<{ ok: true }> {
  return fetchJson('/api/restaurant-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, tsMs: Date.now() }),
  })
}

