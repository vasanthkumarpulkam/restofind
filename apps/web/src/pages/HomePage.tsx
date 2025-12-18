import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { getNearbyRestaurants, postLocationPing, postRestaurantClick, type Restaurant } from '../lib/api'
import { getDeviceInfo, getOrCreateDeviceId } from '../lib/device'
import { formatMeters } from '../lib/format'
import { useGeolocation } from '../hooks/useGeolocation'

const POPULAR_CUISINES = [
  'pizza',
  'italian',
  'burger',
  'sushi',
  'indian',
  'thai',
  'mexican',
  'chinese',
  'korean',
  'mediterranean',
  'vegan',
  'seafood',
  'cafe',
  'dessert',
] as const

type PlaceType = 'any' | 'restaurant' | 'cafe' | 'fast_food'

export function HomePage() {
  const { state: geo, request } = useGeolocation()
  const [placeLabel, setPlaceLabel] = useState<string>('')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(false)
  const [error, setError] = useState<string>('')
  const [view, setView] = useState<'list' | 'map'>('list')

  const [filters, setFilters] = useState({
    placeType: 'any' as PlaceType,
    cuisine: '',
    cuisines: [] as string[],
    maxDistanceMeters: 2500,
    minRating: undefined as number | undefined,
    delivery: false,
    pickup: false,
  })

  const coords = geo.status === 'ready' ? geo.coords : null

  // Ask for location immediately on first load.
  useEffect(() => {
    if (geo.status === 'idle') request()
  }, [geo.status, request])

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
        const city = pl?.city
        const region = pl?.regionCode || pl?.region || pl?.locality
        const country = pl?.countryCode || pl?.country
        const preferred =
          city && region
            ? `${city}, ${region}`
            : [pl?.road, pl?.neighbourhood, pl?.city, pl?.region, pl?.country].filter(Boolean).join(', ')
        const label = preferred || pl?.displayName || country || ''
        setPlaceLabel(label)
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
        placeType: filters.placeType,
        cuisine: filters.cuisine || undefined,
        cuisines: filters.cuisines.length ? filters.cuisines : undefined,
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

  const cuisineChips = useMemo(() => {
    const dynamic = cuisines.map((c) => c.toLowerCase())
    const merged = Array.from(new Set<string>([...POPULAR_CUISINES, ...dynamic]))
    return merged.slice(0, 18)
  }, [cuisines])

  const mapCenter = useMemo(() => {
    if (!coords) return [0, 0] as [number, number]
    return [coords.lat, coords.lng] as [number, number]
  }, [coords])

  const toggleCuisine = (c: string) => {
    setFilters((f) => {
      const has = f.cuisines.includes(c)
      const cuisinesNext = has ? f.cuisines.filter((x) => x !== c) : [...f.cuisines, c]
      return { ...f, cuisines: cuisinesNext }
    })
  }

  return (
    <div className="space-y-5">
      {geo.status !== 'ready' ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-xl">
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-fuchsia-600 px-5 py-6 text-white">
              <div className="text-sm/5 text-indigo-50">RestoFind</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">Find restaurants near you</div>
              <div className="mt-2 text-sm text-indigo-50">
                We’ll ask your browser for your exact location so we can show nearby restaurants by distance.
              </div>
            </div>

            <div className="px-5 py-5">
              {geo.status === 'requesting' ? (
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Requesting location permission…</div>
                    <div className="mt-1 text-sm text-slate-600">
                      If you don’t see a prompt, check your browser’s location settings.
                    </div>
                  </div>
                </div>
              ) : geo.status === 'error' ? (
                <div>
                  <div className="text-sm font-semibold text-rose-700">Location needed</div>
                  <div className="mt-1 text-sm text-slate-700">{geo.message}</div>
                  <button
                    onClick={request}
                    className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-slate-900">Allow location access</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Your browser will ask for permission. We only capture location after you consent.
                  </div>
                  <button
                    onClick={request}
                    className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Allow location
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-fuchsia-600 px-5 py-6 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm/5 text-indigo-50">Now showing</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Restaurants near {placeLabel || 'you'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-indigo-50">
                Browse nearby restaurants sorted by distance. Filter by cuisine, rating, and delivery/pickup.
              </p>
            </div>

            {coords ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={request}
                  className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/20 disabled:opacity-60"
                  disabled={geo.status === 'requesting'}
                >
                  {geo.status === 'requesting' ? 'Requesting…' : 'Update location'}
                </button>
                <button
                  onClick={() => void fetchRestaurants()}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-50 disabled:opacity-60"
                  disabled={!coords || loadingRestaurants}
                >
                  {loadingRestaurants ? 'Loading…' : 'Refresh'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-slate-50 p-4 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your location</div>
              {geo.status === 'ready' ? (
                <div className="mt-2">
                  <div className="text-base font-semibold text-slate-900">{placeLabel || 'Location captured'}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {coords?.accuracy != null ? `±${Math.round(coords.accuracy)}m` : ''}
                  </div>
                </div>
              ) : geo.status === 'error' ? (
                <div className="mt-2 text-sm text-rose-700">{geo.message}</div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">
                  {geo.status === 'requesting'
                    ? 'Requesting location permission…'
                    : 'Waiting for location permission…'}
                </div>
              )}
              {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
            </div>

            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick tips</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>• Use filters to narrow by cuisine and distance</li>
                <li>• Tap a card to track clicks for analytics</li>
                <li>• Switch to map view to explore visually</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border bg-slate-50">
              {(
                [
                  { k: 'any', label: 'All' },
                  { k: 'restaurant', label: 'Restaurants' },
                  { k: 'cafe', label: 'Cafés' },
                  { k: 'fast_food', label: 'Fast food' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setFilters((f) => ({ ...f, placeType: opt.k }))}
                  className={`px-3 py-2 text-sm font-semibold ${
                    filters.placeType === opt.k ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('list')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  view === 'list' ? 'bg-indigo-600 text-white' : 'border text-slate-700 hover:bg-slate-50'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  view === 'map' ? 'bg-indigo-600 text-white' : 'border text-slate-700 hover:bg-slate-50'
                }`}
                disabled={!coords}
              >
                Map
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-64">
              <label className="text-sm font-semibold text-slate-800">Search cuisine</label>
              <input
                value={filters.cuisine}
                onChange={(e) => setFilters((f) => ({ ...f, cuisine: e.target.value }))}
                placeholder="e.g. sushi, pizza…"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:w-72">
              <label className="text-sm font-semibold text-slate-800">Distance</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={100}
                  value={filters.maxDistanceMeters}
                  onChange={(e) => setFilters((f) => ({ ...f, maxDistanceMeters: Number(e.target.value) }))}
                  className="w-full"
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

            <button
              onClick={() => void fetchRestaurants()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={!coords || loadingRestaurants}
            >
              Apply
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">Food categories</div>
            <button
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  cuisines: [],
                  cuisine: '',
                  minRating: undefined,
                  delivery: false,
                  pickup: false,
                  placeType: 'any',
                }))
              }
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {cuisineChips.map((c) => {
              const active = filters.cuisines.includes(c)
              return (
                <button
                  key={c}
                  onClick={() => toggleCuisine(c)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    active ? 'bg-indigo-600 text-white' : 'border bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.delivery}
                onChange={(e) => setFilters((f) => ({ ...f, delivery: e.target.checked }))}
              />
              Delivery
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.pickup}
                onChange={(e) => setFilters((f) => ({ ...f, pickup: e.target.checked }))}
              />
              Pickup
            </label>
          </div>
        </div>
      </section>

      {view === 'map' && coords ? (
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Map</h2>
            <div className="text-sm text-slate-600">{restaurants.length} places</div>
          </div>

          <div className="h-[460px] overflow-hidden rounded-xl border">
            <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker center={mapCenter} radius={10} pathOptions={{ color: '#4f46e5' }}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">You</div>
                    <div className="text-xs text-slate-600">{placeLabel || 'Current location'}</div>
                  </div>
                </Popup>
              </CircleMarker>
              {restaurants.map((r) => (
                <Marker key={r.id} position={[r.lat, r.lng]}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-sm text-slate-700">{r.cuisine || 'Cuisine unknown'}</div>
                      <div className="text-xs text-slate-600">{formatMeters(r.distanceMeters)}</div>
                      <a
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Maps
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>
      ) : null}

      {view === 'list' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Nearby places</h2>
            <div className="text-sm text-slate-600">{restaurants.length} results</div>
          </div>

          <div className="grid gap-3">
            {loadingRestaurants ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">Loading nearby places…</div>
            ) : null}

            {restaurants.map((r) => (
              <button
                key={r.id}
                className="group rounded-2xl border bg-white p-4 text-left hover:bg-slate-50"
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
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-semibold text-slate-900">{r.name}</div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.isOpen == null
                            ? 'bg-slate-100 text-slate-700'
                            : r.isOpen
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.isOpen == null ? 'Hours unknown' : r.isOpen ? 'Open' : 'Closed'}
                      </span>
                      {r.category ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {r.category.replace('_', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {r.cuisine ? r.cuisine : 'Cuisine unknown'}
                      {r.address ? ` • ${r.address}` : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {formatMeters(r.distanceMeters)}
                      </span>
                      {r.rating != null ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          ★ {r.rating.toFixed(1)}
                        </span>
                      ) : null}
                      {r.delivery ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Delivery
                        </span>
                      ) : null}
                      {r.pickup ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Pickup
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <a
                      className="inline-flex items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Directions
                    </a>
                  </div>
                </div>
              </button>
            ))}

            {!restaurants.length && coords && !loadingRestaurants ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                No places found within {formatMeters(filters.maxDistanceMeters)}.
              </div>
            ) : null}

            {!coords ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                Waiting for location permission…
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* legacy sections removed */}
      <div className="hidden" />
    </div>
  )
}
