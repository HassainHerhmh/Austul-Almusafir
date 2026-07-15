import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function OfficeReportsPage() {
  const { state, currentOffice, can } = useApp()
  const officeId = currentOffice!.id
  const today = todayStr()
  const month = today.slice(0, 7)

  if (!can('view_reports')) {
    return (
      <div className="panel">
        <div className="empty">ليس لديك صلاحية التقارير</div>
      </div>
    )
  }

  const bookings = state.bookings.filter((b) => b.officeId === officeId && b.status === 'confirmed')
  const todaySales = bookings.filter((b) => b.bookedAt.startsWith(today)).reduce((s, b) => s + b.price, 0)
  const monthSales = bookings.filter((b) => b.bookedAt.startsWith(month)).reduce((s, b) => s + b.price, 0)
  const customers = state.customers.filter((c) => c.officeId === officeId).length

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>تقارير المكتب</h1>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">مبيعات اليوم</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(todaySales)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">مبيعات الشهر</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(monthSales)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">عدد الحجوزات</div>
          <div className="stat-value">{bookings.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">العملاء</div>
          <div className="stat-value">{customers}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>تفصيل الحجوزات المؤكدة</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الراكب</th>
                <th>المقعد</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {[...bookings]
                .reverse()
                .map((b) => (
                  <tr key={b.id}>
                    <td>{b.bookedAt.slice(0, 10)}</td>
                    <td>{b.passengerName}</td>
                    <td>{b.seatNumber}</td>
                    <td>{formatMoney(b.price)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
