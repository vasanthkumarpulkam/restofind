export function getOrCreateDeviceId() {
  const key = 'restofind_device_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing

  const id = (crypto?.randomUUID?.() ?? `dev_${Math.random().toString(16).slice(2)}_${Date.now()}`)
  localStorage.setItem(key, id)
  return id
}

export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as unknown as { platform?: string }).platform,
  }
}
