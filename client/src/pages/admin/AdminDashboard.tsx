import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GpsLog } from '../../lib/api'
import {
  adminExportCsv,
  adminFetchAnalytics,
  adminFetchLatestUsers,
  adminFetchLogs,
  adminPurgeLogs,
  type AdminAnalytics,
} from '../../lib/admin'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'

const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString()
const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString()
const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString()

// Fix default marker icons in bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

function fmtTs(tsMs: number) {
  return new Date(tsMs).toLocaleString()
}

export default function AdminDashboard(props: {
  token: string
  onLogout: () => void
  onAuthError: () => void
}) {
  const [tab, setTab] = useState<'logs' | 'map' | 'analytics'>('logs')
  const [logs, setLogs] = useState<GpsLog[]>([])
  const [latestUsers, setLatestUsers] = useState<GpsLog[]>([])
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [rangeDays, setRangeDays] = useState(7)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const center = useMemo<[number, number]>(() => {
    const first = latestUsers[0]
    return first ? [first.lat, first.lng] : [0, 0]
  }, [latestUsers])

  async function loadAll() {
    setError(null)
    setLoading(true)
    try {
      const [l, u, a] = await Promise.all([
        adminFetchLogs(props.token, { limit: 250 }),
        adminFetchLatestUsers(props.token),
        adminFetchAnalytics(props.token, rangeDays),
      ])
      setLogs(l.logs)
      setLatestUsers(u.users)
      setAnalytics(a.analytics)
    } catch (e: unknown) {
      const status = (
        e instanceof Error ? (e.cause as unknown as { status?: number } | undefined)?.status : undefined
      ) as number | undefined
      if (status === 401 || status === 403) {
        props.onAuthError()
        return
      }
      setError(e instanceof Error ? e.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays])

  useEffect(() => {
    const url = `/api/admin/stream/logs?token=${encodeURIComponent(props.token)}`
    const es = new EventSource(url)
    es.addEventListener('gps_log', (ev) => {
      try {
        const next = JSON.parse((ev as MessageEvent).data) as GpsLog
        setLogs((prev) => [next, ...prev].slice(0, 500))
        setLatestUsers((prev) => {
          const idx = prev.findIndex((x) => x.userId === next.userId)
          const copy = prev.slice()
          if (idx >= 0) copy.splice(idx, 1)
          return [next, ...copy].slice(0, 500)
        })
      } catch {
        // ignore
      }
    })
    es.onerror = () => {
      // SSE best-effort; keep UI functional via manual refresh
    }
    return () => es.close()
  }, [props.token])

  async function exportCsv() {
    setError(null)
    try {
      const blob = await adminExportCsv(props.token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gps_logs.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  async function purge(days: number) {
    setError(null)
    try {
      await adminPurgeLogs(props.token, days)
      await loadAll()
    } catch (e: unknown) {
      const status = (
        e instanceof Error ? (e.cause as unknown as { status?: number } | undefined)?.status : undefined
      ) as number | undefined
      if (status === 401 || status === 403) {
        props.onAuthError()
        return
      }
      setError(e instanceof Error ? e.message : 'Purge failed')
    }
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <div className="text-lg font-semibold">RestoFind Admin</div>
            <div className="text-xs text-slate-500">Real-time-ish GPS logs + map + analytics</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Back to app
            </Link>
            <button
              className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={props.onLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['logs', 'map', 'analytics'] as const).map((t) => (
              <button
                key={t}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  tab === t ? 'bg-slate-900 text-white' : 'border bg-white hover:bg-slate-50'
                }`}
                onClick={() => setTab(t)}
              >
                {t === 'logs' ? 'Logs' : t === 'map' ? 'Map' : 'Analytics'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={exportCsv}
            >
              Export CSV
            </button>
            <button
              className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => purge(30)}
            >
              Purge &gt; 30d
            </button>
            <button
              className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={loadAll}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error ? <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-red-600">{error}</div> : null}

        {tab === 'logs' ? (
          <div className="mt-4 rounded-xl border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">GPS logs</div>
              <div className="text-xs text-slate-500">{logs.length} shown</div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-xs text-slate-500">
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Lat</th>
                    <th className="px-4 py-2">Lng</th>
                    <th className="px-4 py-2">Accuracy</th>
                    <th className="px-4 py-2">Place</th>
                    <th className="px-4 py-2">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 text-xs text-slate-600">{fmtTs(l.tsMs)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{l.userId.slice(0, 8)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{l.lat.toFixed(6)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{l.lng.toFixed(6)}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {l.accuracyM != null ? `${Math.round(l.accuracyM)} m` : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">
                        <div className="max-w-[420px] truncate">
                          {l.placeName || `${l.road || ''} ${l.city || ''}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {l.city || '—'}
                          {l.locality ? ` • ${l.locality}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">
                        {l.userAgent ? l.userAgent.slice(0, 50) : '—'}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-600" colSpan={7}>
                        No logs yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === 'map' ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 lg:col-span-1">
              <div className="text-sm font-semibold">Users (latest ping)</div>
              <div className="mt-2 grid gap-2">
                {latestUsers.slice(0, 50).map((u) => (
                  <div key={u.userId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs">{u.userId.slice(0, 12)}</div>
                      <div className="text-[11px] text-slate-500">{fmtTs(u.tsMs)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{u.city || u.placeName || '—'}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                    </div>
                  </div>
                ))}
                {latestUsers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-slate-600">
                    No user pings yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white lg:col-span-2">
              <div className="border-b px-4 py-3 text-sm font-semibold">Map</div>
              <div className="h-[520px]">
                <MapContainer center={center} zoom={latestUsers.length ? 13 : 2} className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {latestUsers.map((u) => (
                    <Marker key={u.userId} position={[u.lat, u.lng]}>
                      <Popup>
                        <div className="text-sm font-semibold">User {u.userId.slice(0, 12)}</div>
                        <div className="mt-1 text-xs">{fmtTs(u.tsMs)}</div>
                        <div className="mt-1 text-xs">{u.placeName || '—'}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {u.lat.toFixed(6)}, {u.lng.toFixed(6)} •{' '}
                          {u.accuracyM != null ? `${Math.round(u.accuracyM)} m` : '—'}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'analytics' ? (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Analytics</div>
                <div className="text-xs text-slate-500">Derived from pings + restaurant clicks</div>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Range</span>
                <select
                  className="rounded-md border px-2 py-2"
                  value={rangeDays}
                  onChange={(e) => setRangeDays(Number(e.target.value))}
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>
            </div>

            {!analytics ? (
              <div className="mt-4 rounded-lg border border-dashed p-6 text-sm text-slate-600">Loading…</div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Daily/weekly user pings</div>
                  <div className="mt-2 grid gap-1 text-xs">
                    {analytics.pingsByDay.map((x) => (
                      <div key={x.day} className="flex items-center justify-between">
                        <span className="text-slate-600">{x.day}</span>
                        <span className="font-semibold">{x.count}</span>
                      </div>
                    ))}
                    {analytics.pingsByDay.length === 0 ? (
                      <div className="text-slate-600">No pings in range.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Most common user cities</div>
                  <div className="mt-2 grid gap-1 text-xs">
                    {analytics.topCities.map((x) => (
                      <div key={x.city} className="flex items-center justify-between">
                        <span className="text-slate-600">{x.city}</span>
                        <span className="font-semibold">{x.count}</span>
                      </div>
                    ))}
                    {analytics.topCities.length === 0 ? <div className="text-slate-600">—</div> : null}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Most clicked cuisines / restaurants</div>
                  <div className="mt-2 grid gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-700">Cuisines</div>
                      <div className="mt-1 grid gap-1">
                        {analytics.topCuisines.map((x) => (
                          <div key={x.cuisine} className="flex items-center justify-between">
                            <span className="text-slate-600">{x.cuisine}</span>
                            <span className="font-semibold">{x.count}</span>
                          </div>
                        ))}
                        {analytics.topCuisines.length === 0 ? <div className="text-slate-600">—</div> : null}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">Restaurants</div>
                      <div className="mt-1 grid gap-1">
                        {analytics.topRestaurants.map((x) => (
                          <div key={x.name} className="flex items-center justify-between">
                            <span className="text-slate-600">{x.name}</span>
                            <span className="font-semibold">{x.count}</span>
                          </div>
                        ))}
                        {analytics.topRestaurants.length === 0 ? <div className="text-slate-600">—</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}

