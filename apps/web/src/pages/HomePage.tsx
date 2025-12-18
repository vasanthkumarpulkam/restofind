import { useEffect, useMemo, useState } from 'react'
import { getNearbyRestaurants, postLocationPing, postRestaurantClick, type Restaurant } from '../lib/api'
import { getDeviceInfo, getOrCreateDeviceId } from '../lib/device'
import { formatMeters } from '../lib/format'
import { useGeolocation } from '../hooks/useGeolocation'

export function HomePage() {
  const { state: geo, request } = useGeolocation()
  const [placeLabel, setPlaceLabel] = useState<string>('')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(false)
  const [error, setError] = useState<string>('')

  const [filters, setFilters] = useState({
    cuisine: '',
    maxDistanceMeters: 2500,
    minRating: undefined as number | undefined,
    delivery: false,
    pickup: false,
  })

  const coords = geo.status === 'ready' ? geo.coords : null

  useEffect(() => {
    setError('')
  }, [geo.status])

  useEffect(() => {
    if (geo.status !== 'ready') return

    const run = async () => {
      try {
        const deviceId = getOrCreateDeviceId()
        const info = getDeviceInfo()
        const ping = await postLocationPing({
          deviceId,
          lat: geo.coords.lat,
          lng: geo.coords.lng,
          accuracy: geo.coords.accuracy,
          timestamp: geo.timestamp,
          ...info,
        })

        const pl = ping.place
        const label = [pl?.road, pl?.neighbourhood, pl?.city, pl?.country].filter(Boolean).join(', ')
        setPlaceLabel(label || pl?.displayName || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to log location')
      }
    }

    void run()
  }, [geo])

  const fetchRestaurants = async () => {
    if (!coords) return
    setLoadingRestaurants(true)
    setError('')
    try {
      const resp = await getNearbyRestaurants({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: Math.max(filters.maxDistanceMeters, 1500),
        cuisine: filters.cuisine || undefined,
        maxDistanceMeters: filters.maxDistanceMeters,
        minRating: filters.minRating,
        delivery: filters.delivery ? true : undefined,
        pickup: filters.pickup ? true : undefined,
      })
      setRestaurants(resp.restaurants)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load restaurants')
    } finally {
      setLoadingRestaurants(false)
    }
  }

  useEffect(() => {
    if (!coords) return
    void fetchRestaurants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng])

  const cuisines = useMemo(() => {
    const set = new Set<string>()
    restaurants.forEach((r) => {
      const c = (r.cuisine ?? '').trim()
      if (!c) return
      c.split(',').forEach((p) => set.add(p.trim()))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 30)
  }, [restaurants])

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-slate-500">Your location</div>
            {geo.status === 'ready' ? (
              <div className="mt-1">
                <div className="font-medium text-slate-900">
                  {placeLabel || 'Location captured'}
                </div>
                <div className="text-sm text-slate-600">
                  Lat {coords?.lat.toFixed(6)}, Lng {coords?.lng.toFixed(6)}
                  {coords?.accuracy != null ? ` • ±${Math.round(coords.accuracy)}m` : ''}
                </div>
              </div>
            ) : geo.status === 'error' ? (
              <div className="mt-1 text-sm text-rose-700">{geo.message}</div>
            ) : (
              <div className="mt-1 text-sm text-slate-600">
                We’ll ask your browser for exact GPS permission.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={request}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              disabled={geo.status === 'requesting'}
            >
              {geo.status === 'requesting' ? 'Requesting…' : 'Enable location'}
            </button>

            <button
              onClick={() => void fetchRestaurants()}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              disabled={!coords || loadingRestaurants}
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-rose-700">{error}</div> : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="text-sm font-semibold text-slate-800">Cuisine</label>
            <input
              value={filters.cuisine}
              onChange={(e) => setFilters((f) => ({ ...f, cuisine: e.target.value }))}
              placeholder={cuisines.length ? `e.g. ${cuisines[0]}` : 'e.g. italian, sushi'}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Max distance</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={filters.maxDistanceMeters}
                onChange={(e) => setFilters((f) => ({ ...f, maxDistanceMeters: Number(e.target.value) }))}
                className="w-56"
              />
              <div className="w-20 text-sm text-slate-700">{formatMeters(filters.maxDistanceMeters)}</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Min rating</label>
            <select
              value={filters.minRating ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minRating: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="mt-1 w-36 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.delivery}
              onChange={(e) => setFilters((f) => ({ ...f, delivery: e.target.checked }))}
            />
            Delivery
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.pickup}
              onChange={(e) => setFilters((f) => ({ ...f, pickup: e.target.checked }))}
            />
            Pickup
          </label>

          <button
            onClick={() => void fetchRestaurants()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={!coords || loadingRestaurants}
          >
            {loadingRestaurants ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Nearby restaurants</h2>
          <div className="text-sm text-slate-600">{restaurants.length} results</div>
        </div>

        <div className="grid gap-3">
          {restaurants.map((r) => (
            <button
              key={r.id}
              className="rounded-xl border bg-white p-4 text-left hover:bg-slate-50"
              onClick={() => {
                const deviceId = getOrCreateDeviceId()
                void postRestaurantClick({
                  deviceId,
                  restaurantId: r.id,
                  name: r.name,
                  cuisine: r.cuisine,
                  timestamp: new Date().toISOString(),
                }).catch(() => undefined)
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">{r.name}</div>
                  <div className="text-sm text-slate-600">
                    {r.cuisine ? r.cuisine : 'Cuisine unknown'}
                    {r.address ? ` • ${r.address}` : ''}
                  </div>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="font-semibold">{formatMeters(r.distanceMeters)}</div>
                  <div>
                    {r.isOpen == null ? 'Hours unknown' : r.isOpen ? 'Open now' : 'Closed'}
                    {r.rating != null ? ` • ★ ${r.rating.toFixed(1)}` : ''}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {!restaurants.length && coords ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
              No restaurants found within {formatMeters(filters.maxDistanceMeters)}.
            </div>
          ) : null}

          {!coords ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
              Enable location to see restaurants near you.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
