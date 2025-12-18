import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { adminDownloadCsv, adminGetAnalytics, adminGetLogs, adminPurgeLogs, type AdminAnalytics, type AdminLog } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { clearAdminToken, getAdminToken } from '../lib/adminAuth'

export function AdminDashboardPage() {
  const nav = useNavigate()
  const [token, setToken] = useState(getAdminToken())
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) nav('/admin/login')
  }, [nav, token])

  useEffect(() => {
    if (!token) return

    let alive = true

    const load = async () => {
      try {
        setError('')
        const [l, a] = await Promise.all([adminGetLogs(token, 250), adminGetAnalytics(token, 30)])
        if (!alive) return
        setLogs(l.logs)
        setAnalytics(a)
      } catch (e) {
        if (!alive) return
        const msg = e instanceof Error ? e.message : 'Failed to load admin data'
        setError(msg)
        if (msg.includes('401') || msg.includes('403')) {
          clearAdminToken()
          setToken('')
          nav('/admin/login')
        }
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()

    const t = window.setInterval(() => void load(), 5000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [nav, token])

  const latestByDevice = useMemo(() => {
    const map = new Map<string, AdminLog>()
    for (const l of logs) {
      if (!map.has(l.deviceId)) map.set(l.deviceId, l)
    }
    return Array.from(map.values())
  }, [logs])

  const mapCenter = useMemo(() => {
    const first = latestByDevice[0]
    return first ? ([first.lat, first.lng] as [number, number]) : ([0, 0] as [number, number])
  }, [latestByDevice])

  if (!token) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Admin dashboard</h1>
          <div className="text-sm text-slate-600">Live user pings • map • analytics • export</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => void adminDownloadCsv(token).catch((e) => setError(e instanceof Error ? e.message : 'CSV export failed'))}
          >
            Export CSV
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() =>
              void adminPurgeLogs(token, 30)
                .then(() => adminGetLogs(token, 250).then((l) => setLogs(l.logs)))
                .catch((e) => setError(e instanceof Error ? e.message : 'Purge failed'))
            }
          >
            Purge &gt;30d
          </button>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              clearAdminToken()
              setToken('')
              nav('/admin/login')
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Map view</div>
            <div className="text-xs text-slate-500">Showing latest ping per device</div>
          </div>

          <div className="h-[420px] overflow-hidden rounded-lg border">
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {latestByDevice.map((l) => (
                <Marker key={l.deviceId} position={[l.lat, l.lng]}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{l.deviceId}</div>
                      <div>
                        {l.place?.displayName || [l.place?.road, l.place?.city].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="text-xs text-slate-600">{formatDateTime(l.timestamp)}</div>
                      <div className="text-xs text-slate-600">
                        {l.lat.toFixed(6)}, {l.lng.toFixed(6)} {l.accuracy != null ? `±${Math.round(l.accuracy)}m` : ''}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Analytics (last 30d)</div>
          {loading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : analytics ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">User pings</div>
                  <div className="text-lg font-semibold text-slate-900">{analytics.totals?.pings ?? '—'}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Restaurant clicks</div>
                  <div className="text-lg font-semibold text-slate-900">{analytics.totals?.clicks ?? '—'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">Top cities</div>
                <div className="mt-1 space-y-1">
                  {(analytics.topCities ?? []).slice(0, 5).map((c) => (
                    <div key={c._id} className="flex justify-between">
                      <span className="text-slate-800">{c._id}</span>
                      <span className="text-slate-500">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">Top clicked cuisines</div>
                <div className="mt-1 space-y-1">
                  {(analytics.topCuisines ?? []).slice(0, 5).map((c) => (
                    <div key={c._id} className="flex justify-between">
                      <span className="text-slate-800">{c._id}</span>
                      <span className="text-slate-500">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">Top clicked restaurants</div>
                <div className="mt-1 space-y-1">
                  {(analytics.topRestaurants ?? []).slice(0, 5).map((r) => (
                    <div key={r._id?.id} className="flex justify-between gap-2">
                      <span className="truncate text-slate-800" title={r._id?.name}>
                        {r._id?.name}
                      </span>
                      <span className="shrink-0 text-slate-500">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No data yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Real-time GPS logs</div>
          <div className="text-xs text-slate-500">Polling every 5s</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Lat/Lng</th>
                <th className="px-3 py-2">Place</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Browser</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, idx) => (
                <tr key={`${l.deviceId}-${l.timestamp}-${idx}`} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{l.deviceId}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {l.lat.toFixed(5)}, {l.lng.toFixed(5)} {l.accuracy != null ? `±${Math.round(l.accuracy)}m` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {l.place?.displayName || [l.place?.road, l.place?.city].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(l.timestamp)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {(l.userAgent || '').slice(0, 80) || '—'}
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-600">
                    No pings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
