import { useMemo, useState } from 'react'
import type { GpsLog, Place, Restaurant } from '../lib/api'
import { fetchRestaurants, postLocation, trackRestaurantClick } from '../lib/api'
import { requestExactLocation } from '../lib/geolocation'
import { getOrCreateUserId } from '../lib/user'
import { Link } from 'react-router-dom'

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export default function HomePage() {
  const userId = useMemo(() => getOrCreateUserId(), [])
  const [geoLoading, setGeoLoading] = useState(false)
  const [restaurantsLoading, setRestaurantsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [log, setLog] = useState<GpsLog | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  const [radiusM, setRadiusM] = useState(1500)
  const [cuisine, setCuisine] = useState<string>('all')
  const [maxDistanceM, setMaxDistanceM] = useState<number>(5000)
  const [minRating, setMinRating] = useState<number>(0)
  const [delivery, setDelivery] = useState(false)
  const [pickup, setPickup] = useState(false)

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of restaurants) {
      if (r.cuisine) set.add(r.cuisine)
    }
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [restaurants])

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      if (cuisine !== 'all' && r.cuisine !== cuisine) return false
      if (Number.isFinite(maxDistanceM) && r.distanceM > maxDistanceM) return false
      if ((r.rating ?? 0) < minRating) return false
      if (delivery && !r.delivery) return false
      if (pickup && !r.pickup) return false
      return true
    })
  }, [restaurants, cuisine, maxDistanceM, minRating, delivery, pickup])

  async function handleGetLocation() {
    setError(null)
    setGeoLoading(true)
    try {
      const geo = await requestExactLocation()
      const resp = await postLocation({
        userId,
        lat: geo.lat,
        lng: geo.lng,
        accuracyM: geo.accuracyM,
        tsMs: geo.tsMs,
      })
      setLog(resp.log)
      setPlace(resp.place)

      setRestaurantsLoading(true)
      const rr = await fetchRestaurants({ lat: geo.lat, lng: geo.lng, radiusM, limit: 80 })
      setRestaurants(rr.restaurants)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get location')
    } finally {
      setGeoLoading(false)
      setRestaurantsLoading(false)
    }
  }

  async function handleRestaurantClick(r: Restaurant) {
    try {
      await trackRestaurantClick({
        userId,
        restaurantId: r.id,
        name: r.name,
        cuisine: r.cuisine,
      })
    } catch {
      // best-effort; ignore
    }
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <div className="text-lg font-semibold">RestoFind</div>
            <div className="text-xs text-slate-500">Nearby restaurants from your exact GPS</div>
          </div>
          <Link to="/admin" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 md:col-span-1">
            <div className="text-sm font-semibold">Your location</div>
            <div className="mt-2 text-sm text-slate-700">
              This app will request browser permission for your exact GPS location.
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Search radius</span>
                <input
                  type="range"
                  min={300}
                  max={5000}
                  step={100}
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">{formatDistance(radiusM)}</span>
              </label>

              <button
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={handleGetLocation}
                disabled={geoLoading || restaurantsLoading}
              >
                {geoLoading ? 'Requesting permission…' : 'Use my exact location'}
              </button>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              {log ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-800">Captured</div>
                  <div className="mt-1 grid gap-1 text-xs text-slate-600">
                    <div>
                      <span className="font-medium">Lat/Lng:</span> {log.lat.toFixed(6)},{' '}
                      {log.lng.toFixed(6)}
                    </div>
                    <div>
                      <span className="font-medium">Accuracy:</span>{' '}
                      {log.accuracyM != null ? `${Math.round(log.accuracyM)} m` : '—'}
                    </div>
                    <div>
                      <span className="font-medium">Timestamp:</span>{' '}
                      {new Date(log.tsMs).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Place:</span>{' '}
                      {place?.placeName || log.placeName || '—'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 md:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Nearby restaurants</div>
                <div className="text-xs text-slate-500">
                  Sorted by distance (closest first). Data source: OpenStreetMap.
                </div>
              </div>
              {restaurantsLoading ? (
                <div className="text-xs text-slate-500">Loading…</div>
              ) : (
                <div className="text-xs text-slate-500">{filteredRestaurants.length} results</div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Cuisine</span>
                <select
                  className="rounded-md border px-2 py-2"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                >
                  {cuisineOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All' : c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Max distance</span>
                <input
                  type="range"
                  min={200}
                  max={15000}
                  step={100}
                  value={maxDistanceM}
                  onChange={(e) => setMaxDistanceM(Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">{formatDistance(maxDistanceM)}</span>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Min rating</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">{minRating.toFixed(1)}+</span>
              </label>

              <div className="flex items-center gap-4 pt-6 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
                  Delivery
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} />
                  Pickup
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {!log ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-slate-600">
                  Click <span className="font-semibold">Use my exact location</span> to request GPS permission
                  and see nearby restaurants.
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-slate-600">
                  No restaurants found within your filters. Try increasing radius or max distance.
                </div>
              ) : (
                filteredRestaurants.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRestaurantClick(r)}
                    className="rounded-lg border p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.name}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {r.cuisine || 'Cuisine: —'} • Rating: {r.rating ?? '—'} •{' '}
                          {r.openNow === true
                            ? 'Open now'
                            : r.openNow === false
                              ? 'Closed'
                              : 'Open/closed: —'}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-800">
                        {formatDistance(r.distanceM)}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      {r.delivery ? <span className="rounded-full bg-slate-100 px-2 py-1">Delivery</span> : null}
                      {r.pickup ? <span className="rounded-full bg-slate-100 px-2 py-1">Pickup</span> : null}
                      <span className="rounded-full bg-slate-100 px-2 py-1">Source: {r.source}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

