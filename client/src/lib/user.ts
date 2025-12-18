const KEY = 'restofind_user_id'

export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(KEY, id)
  return id
}

