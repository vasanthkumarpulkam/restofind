import { useEffect, useState } from 'react'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import { clearAdminToken, getAdminToken } from '../../lib/admin'

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => getAdminToken())

  useEffect(() => {
    if (!token) clearAdminToken()
  }, [token])

  if (!token) {
    return <AdminLogin onLoggedIn={(t) => setToken(t)} />
  }

  return (
    <AdminDashboard
      token={token}
      onLogout={() => {
        clearAdminToken()
        setToken(null)
      }}
      onAuthError={() => {
        clearAdminToken()
        setToken(null)
      }}
    />
  )
}

