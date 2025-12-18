import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminLogin, setAdminToken } from '../../lib/admin'

export default function AdminLogin(props: { onLoggedIn: (token: string) => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const resp = await adminLogin({ username, password })
      setAdminToken(resp.token)
      props.onLoggedIn(resp.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold">RestoFind Admin</div>
          <Link to="/" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mx-auto max-w-md rounded-xl border bg-white p-6">
          <div className="text-sm font-semibold">Secure login</div>
          <div className="mt-1 text-xs text-slate-500">
            Uses a JWT token. Configure credentials via server env vars.
          </div>

          <form className="mt-4 grid gap-3" onSubmit={submit}>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Username</span>
              <input
                className="rounded-md border px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Password</span>
              <input
                className="rounded-md border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <button
              className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

