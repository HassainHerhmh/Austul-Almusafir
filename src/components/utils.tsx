import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { Role } from '../types'

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: Role[]
}) {
  const { currentUser, loading } = useApp()
  if (loading) {
    return (
      <div className="panel">
        <div className="empty">جاري التحميل…</div>
      </div>
    )
  }
  if (!currentUser) return <Navigate to="/login" replace />
  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/office'} replace />
  }
  return <>{children}</>
}

export function formatMoney(n: number) {
  return `${n.toLocaleString('ar-YE')} ر.ي`
}

/** تحويل HH:mm أو HH:mm:ss إلى عرض عربي مثل «1 مساء» / «8 صباحاً» */
export function formatTimeAr(time: string | null | undefined) {
  if (!time) return '—'
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return time
  let h = Number(m[1])
  const min = m[2]
  if (!Number.isFinite(h) || h < 0 || h > 23) return time
  const period = h < 12 ? 'صباحاً' : 'مساء'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return min === '00' ? `${h12} ${period}` : `${h12}:${min} ${period}`
}

/** تاريخ محلي YYYY-MM-DD (يتجنب فرق توقيت UTC) */
export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** تاريخ قبل N أيام (محلي) */
export function daysAgoStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدير النظام',
  office_manager: 'مدير مكتب',
  booking_clerk: 'موظف حجز',
  accountant: 'محاسب',
}

export const PAYMENT_LABELS = {
  cash: 'نقدي',
  transfer: 'تحويل',
  credit: 'آجل',
} as const

export const DRIVER_ROLE_LABELS = {
  primary: 'رسمي',
  assistant: 'معاون',
} as const
