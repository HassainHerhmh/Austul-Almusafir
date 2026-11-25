import { X } from 'lucide-react'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
type OpenTab = { path: string; label: string }

const STORAGE_KEY = 'austul-open-tabs'

const ROUTE_LABELS: { path: string; label: string; end?: boolean }[] = [
  { path: '/admin', label: 'لوحة التحكم', end: true },
  { path: '/admin/branches', label: 'الفروع' },
  { path: '/admin/offices', label: 'المكاتب' },
  { path: '/admin/users', label: 'المستخدمون' },
  { path: '/admin/buses', label: 'الباصات' },
  { path: '/admin/maintenance', label: 'صيانات الحافلات' },
  { path: '/admin/maintenance/repair-types', label: 'أنواع الإصلاحات' },
  { path: '/admin/maintenance/spare-parts', label: 'قطع الغيار' },
  { path: '/admin/maintenance/expenses', label: 'مصاريف الصيانات' },
  { path: '/admin/drivers', label: 'السائقون' },
  { path: '/admin/destinations', label: 'الوجهات' },
  { path: '/admin/visa-types', label: 'أنواع التأشيرات' },
  { path: '/admin/trips', label: 'الرحلات' },
  { path: '/admin/bookings', label: 'الحجوزات' },
  { path: '/admin/tracking', label: 'تتبع الباصات' },
  { path: '/admin/accounts', label: 'الحسابات' },
  { path: '/admin/accounts/setup/accounts', label: 'دليل الحسابات' },
  { path: '/admin/accounts/setup/currencies', label: 'العملات' },
  { path: '/admin/accounts/setup/banks', label: 'البنوك' },
  { path: '/admin/accounts/setup/bank-groups', label: 'مجموعة البنوك' },
  { path: '/admin/accounts/setup/cash-boxes', label: 'الصناديق' },
  { path: '/admin/accounts/setup/cash-box-groups', label: 'مجموعات الصناديق' },
  { path: '/admin/accounts/setup/receipt-types', label: 'أنواع سندات القبض' },
  { path: '/admin/accounts/setup/payment-types', label: 'أنواع سندات الصرف' },
  { path: '/admin/accounts/setup/journal-types', label: 'أنواع القيود' },
  { path: '/admin/accounts/setup/account-groups', label: 'مجموعة الحسابات' },
  { path: '/admin/accounts/setup/account-ceiling', label: 'تسقيف الحسابات' },
  { path: '/admin/accounts/setup/transit-accounts', label: 'الحسابات الوسيطة' },
  { path: '/admin/accounts/operations/receipt-voucher', label: 'سند قبض' },
  { path: '/admin/accounts/operations/payment-voucher', label: 'سند صرف' },
  { path: '/admin/accounts/operations/journal-entry', label: 'قيد يومية' },
  { path: '/admin/accounts/operations/currency-exchange', label: 'صرف عملات' },
  { path: '/admin/accounts/reports/account-statement', label: 'كشف حساب' },
  { path: '/admin/accounts/journal-review', label: 'مراجعة القيود' },
  { path: '/admin/reports', label: 'التقارير' },
  { path: '/admin/print-settings', label: 'إعدادات الطباعة' },
  { path: '/admin/partner-api', label: 'ربط API' },
  { path: '/admin/settings', label: 'الإعدادات' },
  { path: '/office', label: 'لوحة المكتب', end: true },
  { path: '/office/staff', label: 'الموظفون' },
  { path: '/office/permissions', label: 'صلاحية المستخدمين' },
  { path: '/office/bookings', label: 'الحجوزات' },
  { path: '/office/tracking', label: 'تتبع الباصات' },
  { path: '/office/accounting', label: 'المحاسبة' },
  { path: '/office/statement', label: 'كشف الحساب' },
  { path: '/office/reports', label: 'التقارير' },
  { path: '/office/payments-report', label: 'تقرير المدفوعات' },
  { path: '/office/customers', label: 'العملاء' },
  { path: '/branch', label: 'لوحة الفرع', end: true },
  { path: '/branch/offices', label: 'مكاتب الفرع' },
  { path: '/branch/staff', label: 'موظفو الفرع' },
  { path: '/branch/bookings', label: 'حجوزات الفرع' },
  { path: '/branch/statement', label: 'كشف ذمة الفرع' },
]

function normalizePath(path: string) {
  if (!path) return '/'
  const cleaned = path.split('?')[0].split('#')[0]
  if (cleaned.length > 1 && cleaned.endsWith('/')) return cleaned.slice(0, -1)
  return cleaned || '/'
}

function labelLookupPath(path: string) {
  return path.startsWith('/branch') ? path.replace(/^\/branch/, '/admin') : path
}

function isShellPath(path: string) {
  return (
    path.startsWith('/admin') || path.startsWith('/office') || path.startsWith('/branch')
  )
}

function tabsScope(path: string) {
  if (path.startsWith('/office')) return 'office'
  if (path.startsWith('/branch')) return 'branch'
  return 'admin'
}

function labelForPath(path: string) {
  const p = normalizePath(path)
  const lookup = labelLookupPath(p)
  const exact = ROUTE_LABELS.find((r) => r.path === lookup)
  if (exact) return exact.label

  // أطول مسار مطابق كبادئة
  let best: { path: string; label: string } | null = null
  for (const r of ROUTE_LABELS) {
    if (r.end) continue
    if (lookup === r.path || lookup.startsWith(`${r.path}/`)) {
      if (!best || r.path.length > best.path.length) best = r
    }
  }
  if (best) return best.label
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] || 'صفحة'
}

function homeForPath(path: string) {
  if (path.startsWith('/office')) return '/office'
  if (path.startsWith('/branch')) return '/branch'
  return '/admin'
}

function loadTabs(scope: string): OpenTab[] {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${scope}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OpenTab[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t) => t && typeof t.path === 'string' && typeof t.label === 'string')
      .map((t) => ({ path: normalizePath(t.path), label: t.label }))
  } catch {
    return []
  }
}

function saveTabs(scope: string, tabs: OpenTab[]) {
  try {
    sessionStorage.setItem(`${STORAGE_KEY}:${scope}`, JSON.stringify(tabs))
  } catch {
    /* ignore */
  }
}

export function OpenTabsBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const activePath = normalizePath(location.pathname)
  const scope = tabsScope(activePath)
  const home = homeForPath(activePath)

  const [tabs, setTabs] = useState<OpenTab[]>(() => loadTabs(scope))

  // عند تبديل نطاق admin/office أعد التحميل من التخزين
  useEffect(() => {
    setTabs(loadTabs(scope))
  }, [scope])

  useEffect(() => {
    if (!isShellPath(activePath)) return
    setTabs((prev) => {
      const exists = prev.some((t) => t.path === activePath)
      const next = exists
        ? prev.map((t) => (t.path === activePath ? { ...t, label: labelForPath(activePath) } : t))
        : [...prev, { path: activePath, label: labelForPath(activePath) }]
      saveTabs(scope, next)
      return next
    })
  }, [activePath, scope])

  const visibleTabs = useMemo(() => {
    // تأكد أن الصفحة الحالية موجودة دائماً في الشريط
    if (tabs.some((t) => t.path === activePath)) return tabs
    if (!isShellPath(activePath)) return tabs
    return [...tabs, { path: activePath, label: labelForPath(activePath) }]
  }, [tabs, activePath])

  const closeTab = (path: string, e?: MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path)
      if (idx < 0) return prev
      const next = prev.filter((t) => t.path !== path)
      saveTabs(scope, next)

      if (normalizePath(path) === activePath) {
        const neighbor = next[idx] || next[idx - 1] || null
        navigate(neighbor?.path || home)
      }
      return next
    })
  }

  if (!isShellPath(activePath)) {
    return null
  }

  if (visibleTabs.length === 0) return null

  return (
    <div className="open-tabs-bar" role="tablist" aria-label="الصفحات المفتوحة">
      <div className="open-tabs-scroll">
        {visibleTabs.map((tab) => {
          const active = tab.path === activePath
          return (
            <div
              key={tab.path}
              role="tab"
              aria-selected={active}
              className={`open-tab${active ? ' active' : ''}`}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (!active) navigate(tab.path)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!active) navigate(tab.path)
                }
              }}
              tabIndex={0}
              title={tab.label}
            >
              <span className="open-tab-label">{tab.label}</span>
              <button
                type="button"
                className="open-tab-close"
                aria-label={`إغلاق ${tab.label}`}
                title="إغلاق"
                onClick={(e) => closeTab(tab.path, e)}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
