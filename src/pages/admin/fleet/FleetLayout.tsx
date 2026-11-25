import { Outlet, useLocation } from 'react-router-dom'
import { AppLink } from '../../../components/InAppNavLink'
import { Bus, Cog, Layers } from 'lucide-react'

const tabs = [
  { label: 'الحافلات', path: 'buses', icon: Bus },
  { label: 'أنواع الحافلات', path: 'types', icon: Cog },
  { label: 'موديلات الحافلات', path: 'models', icon: Layers },
]

function fleetBase(pathname: string) {
  if (pathname.startsWith('/branch/fleet')) return '/branch/fleet'
  return '/admin/fleet'
}

export function FleetLayout() {
  const location = useLocation()
  const base = fleetBase(location.pathname)

  return (
    <div dir="rtl">
      <nav className="maintenance-subnav panel" aria-label="الحافلات">
        <ul className="maintenance-subnav-list">
          {tabs.map((tab) => {
            const full = `${base}/${tab.path}`
            const active = location.pathname.includes(`/${tab.path}`)
            const Icon = tab.icon
            return (
              <li key={tab.path}>
                <AppLink to={full} className={`maintenance-subnav-link${active ? ' active' : ''}`}>
                  <Icon size={18} aria-hidden />
                  <span>{tab.label}</span>
                </AppLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}