import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../lib/api'
import { setAdminToken } from '../lib/adminAuth'

export function AdminLoginPage() {
  const nav = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-white p-5">
      <h1 className="text-lg font-semibold text-slate-900">Admin login</h1>
      <p className="mt-1 text-sm text-slate-600">Sign in to view GPS logs, map, and analytics.</p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-800">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        {error ? <div className="text-sm text-rose-700">{error}</div> : null}

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setError('')
            try {
              const resp = await adminLogin({ username, password })
              setAdminToken(resp.token)
              nav('/admin')
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Login failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Default credentials are controlled by API env vars: <code>ADMIN_USER</code>/<code>ADMIN_PASS</code>.
      </div>
    </div>
  )
}
