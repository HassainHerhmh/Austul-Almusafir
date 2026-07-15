import { Link } from 'react-router-dom'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function OfficeHome() {
  const {
    currentOffice,
    state,
    getTripLabel,
    getTripSeats,
    can,
  } = useApp()
  const officeId = currentOffice?.id
  const today = todayStr()

  const myBookings = state.bookings.filter(
    (b) => b.officeId === officeId && b.status === 'confirmed',
  )
  const todaySales = myBookings
    .filter((b) => b.bookedAt.startsWith(today))
    .reduce((s, b) => s + b.price, 0)
  const myCustomers = state.customers.filter((c) => c.officeId === officeId)
  const vouchers = state.vouchers.filter((v) => v.officeId === officeId)
  const cash =
    vouchers.filter((v) => v.type === 'receipt').reduce((s, v) => s + v.amount, 0) -
    vouchers.filter((v) => v.type === 'payment').reduce((s, v) => s + v.amount, 0)

  const upcoming = state.trips
    .filter((t) => t.status === 'scheduled' && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime))

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{currentOffice?.name}</h1>
          <p>رحلات اليوم والقادمة · المقاعد المتبقية · حجوزاتك</p>
        </div>
        {can('book') && (
          <Link to="/office/bookings" className="btn btn-primary">
            حجز جديد
          </Link>
        )}
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">حجوزات المكتب</div>
          <div className="stat-value">{myBookings.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">مبيعات اليوم</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(todaySales)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">العملاء</div>
          <div className="stat-value">{myCustomers.length}</div>
        </div>
        {can('view_accounts') && (
          <div className="stat">
            <div className="stat-label">رصيد الصندوق</div>
            <div className="stat-value" style={{ fontSize: '1.15rem' }}>
              {formatMoney(cash)}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>الرحلات المتاحة (مقاعد مركزية مشتركة)</h2>
        </div>
        <div className="trip-card-list">
          {upcoming.map((trip) => {
            const seats = getTripSeats(trip.id)
            const isToday = trip.date === today
            return (
              <div key={trip.id} className="trip-row">
                <div>
                  <h3>
                    {getTripLabel(trip)}{' '}
                    {isToday && <span className="badge badge-amber badge-warn">اليوم</span>}
                  </h3>
                  <div className="trip-meta">
                    <span>{trip.date}</span>
                    <span>{trip.departureTime}</span>
                    <span>{formatMoney(trip.price)}</span>
                    <span>
                      {trip.stops.map((s) => s.point).filter(Boolean).join(' ← ')}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="badge badge-ok">متبقي {seats.remaining}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    محجوز {seats.booked} من {seats.total}
                  </div>
                  {can('book') && seats.remaining > 0 && (
                    <Link
                      to={`/office/bookings?trip=${trip.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 8 }}
                    >
                      حجز
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {upcoming.length === 0 && <div className="empty">لا توجد رحلات قادمة</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>آخر حجوزات مكتبك</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {[...myBookings]
                .reverse()
                .slice(0, 6)
                .map((b) => {
                  const trip = state.trips.find((t) => t.id === b.tripId)
                  return (
                    <tr key={b.id}>
                      <td>{b.passengerName}</td>
                      <td>{trip ? getTripLabel(trip) : '—'}</td>
                      <td>{b.seatNumber}</td>
                      <td>{formatMoney(b.price)}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
