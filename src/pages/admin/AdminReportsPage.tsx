import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function AdminReportsPage() {
  const { state, getTripLabel, getOffice } = useApp()
  const today = todayStr()
  const month = today.slice(0, 7)

  const confirmed = state.bookings.filter((b) => b.status === 'confirmed')
  const cancelledTrips = state.trips.filter((t) => t.status === 'cancelled')
  const daily = confirmed
    .filter((b) => b.bookedAt.startsWith(today))
    .reduce((s, b) => s + b.price, 0)
  const monthly = confirmed
    .filter((b) => b.bookedAt.startsWith(month))
    .reduce((s, b) => s + b.price, 0)

  const officeSales = state.offices
    .map((o) => ({
      name: o.name,
      total: confirmed.filter((b) => b.officeId === o.id).reduce((s, b) => s + b.price, 0),
      count: confirmed.filter((b) => b.officeId === o.id).length,
    }))
    .sort((a, b) => b.total - a.total)

  const tripLoad = state.trips
    .map((t) => {
      const booked = confirmed.filter((b) => b.tripId === t.id).length
      const bus = state.buses.find((b) => b.id === t.busId)
      const total = bus?.seats ?? 0
      return {
        label: getTripLabel(t),
        date: t.date,
        booked,
        total,
        rate: total ? Math.round((booked / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.rate - a.rate)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>التقارير العامة</h1>
          <p>إجمالي الرحلات والمبيعات والإيرادات</p>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">إجمالي الرحلات</div>
          <div className="stat-value">{state.trips.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">الرحلات الملغاة</div>
          <div className="stat-value">{cancelledTrips.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">إيراد اليوم</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(daily)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">إيراد الشهر</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(monthly)}
          </div>
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
                <th>الحجوزات</th>
                <th>المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {officeSales.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
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
          <h2>أكثر الرحلات إشغالاً</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الرحلة</th>
                <th>التاريخ</th>
                <th>الإشغال</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {tripLoad.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td>{r.date}</td>
                  <td>
                    {r.booked}/{r.total}
                  </td>
                  <td>{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>كشف حساب المكاتب</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>المكتب</th>
                <th>قبض</th>
                <th>صرف</th>
                <th>الصندوق</th>
              </tr>
            </thead>
            <tbody>
              {state.offices.map((o) => {
                const vouchers = state.vouchers.filter((v) => v.officeId === o.id)
                const inAmt = vouchers.filter((v) => v.type === 'receipt').reduce((s, v) => s + v.amount, 0)
                const outAmt = vouchers.filter((v) => v.type === 'payment').reduce((s, v) => s + v.amount, 0)
                return (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{formatMoney(inAmt)}</td>
                    <td>{formatMoney(outAmt)}</td>
                    <td>
                      <strong>{formatMoney(inAmt - outAmt)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
          المكاتب المعروضة: {state.offices.map((o) => getOffice(o.id)?.name).join(' · ')}
        </p>
      </div>
    </div>
  )
}
