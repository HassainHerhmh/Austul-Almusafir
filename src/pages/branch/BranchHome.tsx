import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function BranchHome() {
  const { state, currentBranch } = useApp()
  const today = todayStr()
  const officeIds = useMemo(
    () => new Set(state.offices.filter((o) => o.branchId === currentBranch?.id).map((o) => o.id)),
    [state.offices, currentBranch?.id],
  )
  const branchBookings = useMemo(
    () => state.bookings.filter((b) => officeIds.has(b.officeId)),
    [state.bookings, officeIds],
  )
  const todaySales = branchBookings
    .filter((b) => b.status === 'confirmed' && b.bookedAt.startsWith(today))
    .reduce((s, b) => s + b.price, 0)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{currentBranch?.name ?? 'الفرع'}</h1>
        </div>
        <Link to="/branch/offices" className="btn btn-primary">
          إدارة المكاتب
        </Link>
      </header>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">المكاتب</div>
          <div className="stat-value">{officeIds.size}</div>
        </div>
        <div className="stat">
          <div className="stat-label">حجوزات الفرع</div>
          <div className="stat-value">{branchBookings.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">مبيعات اليوم</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(todaySales)}
          </div>
        </div>
      </div>
    </div>
  )
}