import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Repeat,
  ClipboardList,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Layers,
  Landmark,
  Building2,
  Users,
  ShieldCheck,
  Shuffle,
} from 'lucide-react'
import './accounts.css'

const BASE = '/admin/accounts'

const setupTabs = [
  { label: 'دليل الحسابات', path: 'setup/accounts', icon: BookOpen },
  { label: 'العملات', path: 'setup/currencies', icon: Repeat },
  { label: 'أنواع قيود اليومية', path: 'setup/journal-types', icon: ClipboardList },
  { label: 'أنواع سندات القبض', path: 'setup/receipt-types', icon: ArrowUpCircle },
  { label: 'أنواع سندات الصرف', path: 'setup/payment-types', icon: ArrowDownCircle },
  { label: 'الصناديق النقدية', path: 'setup/cash-boxes', icon: Wallet },
  { label: 'مجموعات الصناديق', path: 'setup/cash-box-groups', icon: Layers },
  { label: 'دليل البنوك', path: 'setup/banks', icon: Landmark },
  { label: 'مجموعة البنوك', path: 'setup/bank-groups', icon: Building2 },
  { label: 'مجموعة الحسابات', path: 'setup/account-groups', icon: Users },
  { label: 'تسقيف الحسابات', path: 'setup/account-ceiling', icon: ShieldCheck },
  { label: 'الحسابات الوسيطة', path: 'setup/transit-accounts', icon: Shuffle },
]

const Accounting = () => {
  const location = useLocation()

  const isSetup = location.pathname.includes('/accounts/setup')
  const isOperations = location.pathname.includes('/accounts/operations')
  const isReports = location.pathname.includes('/accounts/reports')

  return (
    <div className="acc-shell space-y-6" dir="rtl">
      <h1 className="acc-title text-2xl">الحسابات</h1>

      <div className="flex gap-6 acc-border-b pb-2 text-sm font-semibold">
        <Link
          to={`${BASE}/setup/accounts`}
          className={`acc-parent-tab ${isSetup ? 'active' : ''}`}
        >
          التهيئة
        </Link>

        <Link
          to={`${BASE}/operations/receipt-voucher`}
          className={`acc-parent-tab ${isOperations ? 'active' : ''}`}
        >
          العمليات
        </Link>

        <Link
          to={`${BASE}/reports/account-statement`}
          className={`acc-parent-tab ${isReports ? 'active' : ''}`}
        >
          التقارير
        </Link>

        <span className="acc-muted">إدارة الترحيلات</span>
      </div>

      {isSetup && (
        <div className="acc-subnav px-4 py-3 flex flex-wrap gap-4">
          {setupTabs.map((tab) => {
            const Icon = tab.icon
            const to = `${BASE}/${tab.path}`
            const active = location.pathname.endsWith(tab.path)

            return (
              <Link
                key={tab.path}
                to={to}
                className={`acc-subnav-link flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                  active ? 'active' : ''
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </Link>
            )
          })}
        </div>
      )}

      <div className={isOperations ? '' : 'acc-panel p-6 min-h-[300px]'}>
        <Outlet />
      </div>
    </div>
  )
}

export default Accounting
