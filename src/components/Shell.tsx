import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  FileBarChart2,
  LayoutDashboard,
  MapPin,
  Navigation,
  Printer,
  Route,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  UserCircle2,
  Building2,
  Wallet,
  ScrollText,
  Calculator,
  Banknote,
  Stamp,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BrandMark } from './BrandMark'
import { formatMoney } from './utils'
import { TopHeader } from './TopHeader'

const SIDEBAR_COLLAPSE_KEY = 'austul-sidebar-collapsed'

const adminLinks: { to: string; end?: boolean; label: string; icon: LucideIcon }[] = [
  { to: '/admin', end: true, label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/admin/offices', label: 'المكاتب', icon: Building2 },
  { to: '/admin/users', label: 'المستخدمون', icon: Users },
  { to: '/admin/buses', label: 'الباصات', icon: Bus },
  { to: '/admin/drivers', label: 'السائقون', icon: UserCircle2 },
  { to: '/admin/destinations', label: 'الوجهات', icon: MapPin },
  { to: '/admin/visa-types', label: 'أنواع التأشيرات', icon: Stamp },
  { to: '/admin/trips', label: 'الرحلات', icon: Route },
  { to: '/admin/bookings', label: 'الحجوزات', icon: Ticket },
  { to: '/admin/tracking', label: 'تتبع الباصات', icon: Navigation },
  { to: '/admin/accounts', label: 'الحسابات', icon: Calculator },
  { to: '/admin/reports', label: 'التقارير', icon: FileBarChart2 },
  { to: '/admin/print-settings', label: 'إعدادات الطباعة', icon: Printer },
  { to: '/admin/settings', label: 'الإعدادات', icon: Settings },
]

const officeLinks: {
  to: string
  end?: boolean
  label: string
  pageId?: string
  icon: LucideIcon
}[] = [
  { to: '/office', end: true, label: 'لوحة المكتب', pageId: 'dashboard', icon: LayoutDashboard },
  { to: '/office/staff', label: 'الموظفون', pageId: 'staff', icon: Users },
  {
    to: '/office/permissions',
    label: 'صلاحية المستخدمين',
    pageId: 'user-permissions',
    icon: ShieldCheck,
  },
  { to: '/office/bookings', label: 'الحجوزات', pageId: 'bookings', icon: Ticket },
  { to: '/office/tracking', label: 'تتبع الباصات', pageId: 'tracking', icon: Navigation },
  { to: '/office/accounting', label: 'المحاسبة', pageId: 'accounting', icon: Wallet },
  { to: '/office/statement', label: 'كشف الحساب', pageId: 'statement', icon: ScrollText },
  { to: '/office/reports', label: 'التقارير', pageId: 'reports', icon: FileBarChart2 },
  {
    to: '/office/payments-report',
    label: 'تقرير المدفوعات',
    pageId: 'payments-report',
    icon: Banknote,
  },
]

export function Shell() {
  const { currentUser, currentOffice, isAdmin, getOfficeAgencyBalance, state, canPage } = useApp()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('mobile-nav-lock')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('mobile-nav-lock')
    }
  }, [mobileNavOpen])

  const links = isAdmin
    ? adminLinks
    : officeLinks.filter((link) => !link.pageId || canPage(link.pageId, 'view'))
  const agencyBalance =
    !isAdmin && currentOffice ? getOfficeAgencyBalance(currentOffice.id) : 0

  void state.bookings

  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div
      className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileNavOpen ? ' mobile-nav-open' : ''}`}
    >
      <button
        type="button"
        className="mobile-nav-backdrop"
        aria-label="إغلاق القائمة"
        tabIndex={mobileNavOpen ? 0 : -1}
        onClick={closeMobileNav}
      />

      <aside className="sidebar" aria-label="القائمة الجانبية">
        <div className="brand">
          <div className="brand-row">
            <BrandMark
              sub={
                collapsed
                  ? undefined
                  : isAdmin
                    ? 'لوحة مدير النظام'
                    : currentOffice?.name ?? 'مكتب السفريات'
              }
              collapsed={collapsed}
            />
            <button
              type="button"
              className="sidebar-toggle desktop-only"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
              aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <button
              type="button"
              className="sidebar-close mobile-only"
              onClick={closeMobileNav}
              aria-label="إغلاق القائمة"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {!isAdmin && currentOffice && !collapsed && (
          <div className="sidebar-agency-balance">
            <div className="agency-balance-label">الرصيد عليكم لدى الوكالة</div>
            <div className="agency-balance-value">{formatMoney(agencyBalance)}</div>
          </div>
        )}

        <nav className="nav-list">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                title={link.label}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={closeMobileNav}
              >
                <Icon className="nav-link-icon" size={20} strokeWidth={1.9} aria-hidden />
                <span className="nav-link-label">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" title={currentUser?.name || ''}>
            {collapsed ? (
              <span className="user-chip-initial" aria-hidden>
                {(currentUser?.name || currentUser?.username || '?').slice(0, 1)}
              </span>
            ) : (
              <>
                {currentUser?.name}
                <br />
                <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>{currentUser?.username}</span>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="main-column">
        <TopHeader
          onOpenNav={() => setMobileNavOpen(true)}
          menuOpen={mobileNavOpen}
        />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
