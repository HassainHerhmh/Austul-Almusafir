import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppLink } from '../../../components/InAppNavLink'
import { serverApi } from '../../../api/serverApi'
import { Cog, Package, Wrench } from 'lucide-react'

type Stats = { repairTypes: number; spareParts: number; expenses: number }

const tabs = [
  { label: 'أنواع الإصلاحات', path: 'repair-types', icon: Cog },
  { label: 'قطع الغيار', path: 'spare-parts', icon: Package },
  { label: 'مصاريف صيانات الحافلات', path: 'expenses', icon: Wrench },
]

function maintenanceBaseFromPath(pathname: string) {
  if (pathname.startsWith('/branch/maintenance')) return '/branch/maintenance'
  return '/admin/maintenance'
}

export function MaintenanceLayout() {
  const location = useLocation()
  const base = maintenanceBaseFromPath(location.pathname)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    void serverApi.maintenance.stats
      .get()
      .then((res) => setStats(res))
      .catch(() => setStats(null))
  }, [location.pathname])

  return (
    <div dir="rtl">
      <header className="page-header">
        <div>
          <h1>عمليات مصاريف الصيانات</h1>
          <p>أنواع الإصلاح، قطع الغيار، وتقرير مصاريف الحافلات مع الترحيل المحاسبي</p>
        </div>
      </header>

      <nav className="maintenance-subnav panel" aria-label="قائمة الصيانات">
        <ul className="maintenance-subnav-list">
          {tabs.map((tab) => {
            const full = `${base}/${tab.path}`
            const active = location.pathname.includes(`/${tab.path}`)
            const count =
              tab.path === 'repair-types'
                ? stats?.repairTypes
                : tab.path === 'spare-parts'
                  ? stats?.spareParts
                  : stats?.expenses
            const Icon = tab.icon
            return (
              <li key={tab.path}>
                <AppLink to={full} className={`maintenance-subnav-link${active ? ' active' : ''}`}>
                  <Icon size={18} aria-hidden />
                  <span>{tab.label}</span>
                  {count != null && count > 0 && <span className="maintenance-subnav-count">{count}</span>}
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