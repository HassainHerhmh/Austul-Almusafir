import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { BrandMark } from './BrandMark'
import { formatMoney } from './utils'
import { TopHeader } from './TopHeader'

const adminLinks = [
  { to: '/admin', end: true, label: 'لوحة التحكم' },
  { to: '/admin/offices', label: 'المكاتب' },
  { to: '/admin/users', label: 'المستخدمون' },
  { to: '/admin/buses', label: 'الباصات' },
  { to: '/admin/drivers', label: 'السائقون' },
  { to: '/admin/destinations', label: 'الوجهات' },
  { to: '/admin/trips', label: 'الرحلات' },
  { to: '/admin/bookings', label: 'الحجوزات' },
  { to: '/admin/accounts', label: 'الحسابات' },
  { to: '/admin/reports', label: 'التقارير' },
  { to: '/admin/settings', label: 'الإعدادات' },
]

const officeLinks = [
  { to: '/office', end: true, label: 'لوحة المكتب' },
  { to: '/office/bookings', label: 'الحجوزات' },
  { to: '/office/customers', label: 'العملاء' },
  { to: '/office/accounting', label: 'المحاسبة' },
  { to: '/office/reports', label: 'التقارير' },
  { to: '/office/staff', label: 'الموظفون' },
]

export function Shell() {
  const { currentUser, currentOffice, isAdmin, getOfficeAgencyBalance, state } = useApp()
  const links = isAdmin ? adminLinks : officeLinks
  const agencyBalance =
    !isAdmin && currentOffice ? getOfficeAgencyBalance(currentOffice.id) : 0

  void state.bookings

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark
            sub={isAdmin ? 'لوحة مدير النظام' : currentOffice?.name ?? 'مكتب السفريات'}
          />
        </div>

        {!isAdmin && currentOffice && (
          <div className="sidebar-agency-balance">
            <div className="agency-balance-label">الرصيد عليكم لدى الوكالة</div>
            <div className="agency-balance-value">{formatMoney(agencyBalance)}</div>
          </div>
        )}

        <nav className="nav-list">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            {currentUser?.name}
            <br />
            <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>{currentUser?.username}</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <TopHeader />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
