import { useApp } from '../../context/AppContext'
import { formatMoney, todayStr } from '../../components/utils'

export function AdminHome() {
  const { state, getTripLabel, getTripSeats, getOffice } = useApp()
  const today = todayStr()
  const todayTrips = state.trips.filter((t) => t.date === today && t.status === 'scheduled')
  const confirmed = state.bookings.filter((b) => b.status === 'confirmed')
  const sales = confirmed.reduce((s, b) => s + b.price, 0)
  const activeOffices = state.offices.filter((o) => o.status === 'active').length

  const officeSales = state.offices.map((o) => ({
    office: o,
    total: confirmed.filter((b) => b.officeId === o.id).reduce((s, b) => s + b.price, 0),
    count: confirmed.filter((b) => b.officeId === o.id).length,
  })).sort((a, b) => b.total - a.total)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>لوحة مدير النظام</h1>
          <p>إدارة مركزية لجميع المكاتب والرحلات والحجوزات</p>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">المكاتب النشطة</div>
          <div className="stat-value">{activeOffices}</div>
        </div>
        <div className="stat">
          <div className="stat-label">رحلات اليوم</div>
          <div className="stat-value">{todayTrips.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">الحجوزات المؤكدة</div>
          <div className="stat-value">{confirmed.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">إجمالي المبيعات</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {formatMoney(sales)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>رحلات اليوم — المقاعد المشتركة</h2>
        </div>
        <div className="trip-card-list">
          {todayTrips.length === 0 && <div className="empty">لا توجد رحلات اليوم</div>}
          {todayTrips.map((trip) => {
            const seats = getTripSeats(trip.id)
            return (
              <div key={trip.id} className="trip-row">
                <div>
                  <h3>{getTripLabel(trip)}</h3>
                  <div className="trip-meta">
                    <span>{trip.departureTime}</span>
                    <span>{trip.stops.map((s) => s.point).filter(Boolean).join(' ← ')}</span>
                    <span>{formatMoney(trip.price)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div>
                    <span className="badge badge-ok">متبقي {seats.remaining}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    محجوز {seats.booked} / {seats.total}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>أكثر المكاتب مبيعاً</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>المكتب</th>
                <th>عدد الحجوزات</th>
                <th>المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {officeSales.map((r) => (
                <tr key={r.office.id}>
                  <td>{r.office.name}</td>
                  <td>{r.count}</td>
                  <td>{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>آخر الحجوزات</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {[...state.bookings]
                .reverse()
                .slice(0, 8)
                .map((b) => {
                  const trip = state.trips.find((t) => t.id === b.tripId)
                  return (
                    <tr key={b.id}>
                      <td>{b.passengerName}</td>
                      <td>{getOffice(b.officeId)?.name}</td>
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
