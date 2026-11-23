/** عرض نوع الباص: سياحي VIP أو عادي */
export function busTypeLabel(type: string | null | undefined): string {
  const raw = (type ?? '').trim()
  if (!raw) return 'عادي'
  if (/vip/i.test(raw)) return raw.includes('سياح') ? raw : `سياحي (${raw})`
  if (/سياح|فاخر|سياحي|vip/i.test(raw)) return /vip/i.test(raw) ? 'سياحي (VIP)' : 'سياحي'
  if (/عادي|standard|normal/i.test(raw)) return 'عادي'
  return raw
}

export function isTouristBus(type: string | null | undefined): boolean {
  const raw = (type ?? '').trim()
  if (!raw) return false
  return /سياح|vip|فاخر/i.test(raw)
}