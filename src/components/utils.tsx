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
  const { currentUser } = useApp()
  if (!currentUser) return <Navigate to="/login" replace />
  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/office'} replace />
  }
  return <>{children}</>
}

export function formatMoney(n: number) {
  return `${n.toLocaleString('ar-YE')} ر.ي`
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
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
