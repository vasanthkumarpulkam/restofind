export function formatMeters(m: number) {
  if (!Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

export function formatDateTime(isoOrDate: string | Date) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}
