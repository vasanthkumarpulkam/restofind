import { Link, Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const loc = useLocation()

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-semibold text-slate-900">
              RestoFind
            </Link>
            <span className="hidden text-sm text-slate-500 sm:inline">Nearby restaurants from your GPS</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              to="/"
              className={`text-sm ${loc.pathname === '/' ? 'font-semibold text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Home
            </Link>
            <Link
              to="/admin"
              className={`text-sm ${loc.pathname.startsWith('/admin') ? 'font-semibold text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">
          Location is only captured after you grant browser permission.
        </div>
      </footer>
    </div>
  )
}
