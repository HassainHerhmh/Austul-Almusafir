/** تسميات حالة التتبع ومشاكل صلاحيات السائق */

export type TrackStatus = 'live' | 'interrupted' | 'stopped' | 'problem'

export function trackStatusFromItem(item: {
  active: boolean
  updatedAt: string
  clientIssue?: string | null
}): TrackStatus {
  if (item.clientIssue) return 'problem'
  if (!item.active) return 'stopped'
  const stale = Date.now() - new Date(item.updatedAt).getTime() > 2 * 60 * 1000
  if (stale) return 'interrupted'
  return 'live'
}

export function statusLabel(status: TrackStatus) {
  if (status === 'live') return 'مباشر'
  if (status === 'interrupted') return 'انقطع الإرسال'
  if (status === 'problem') return 'مشكلة سماح'
  return 'متوقف'
}

export function statusColor(status: TrackStatus) {
  if (status === 'live') return '#0f766e'
  if (status === 'interrupted') return '#b45309'
  if (status === 'problem') return '#be123c'
  return '#64748b'
}

export function statusBadgeClass(status: TrackStatus) {
  if (status === 'live') return 'badge-ok'
  if (status === 'interrupted') return 'badge-warn'
  return 'badge-danger'
}

export function clientIssueText(
  issue: string | null | undefined,
  message?: string | null,
): string | null {
  if (message?.trim()) return message.trim()
  if (!issue) return null
  switch (issue) {
    case 'gps_off':
      return 'خدمة الموقع (GPS) مغلقة على جهاز السائق'
    case 'permission_denied':
      return 'السائق لم يسمح بإذن الموقع للتطبيق'
    case 'background_denied':
      return 'السائق لم يسمح بالموقع «دائماً / في الخلفية»'
    case 'battery':
      return 'تقييد البطارية يمنع استمرار التتبع على جهاز السائق'
    case 'send_failed':
      return 'تعذر إرسال الموقع من تطبيق السائق'
    default:
      return 'مشكلة في سماح التتبع لدى السائق'
  }
}

export function hasMapCoords(item: { lat: number; lng: number }) {
  return !(item.lat === 0 && item.lng === 0)
}
