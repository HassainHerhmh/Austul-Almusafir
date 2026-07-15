import { formatMoney } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function OfficeCustomersPage() {
  const { state, currentOffice, getTripLabel } = useApp()
  const officeId = currentOffice!.id
  const customers = state.customers.filter((c) => c.officeId === officeId)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>العملاء</h1>
          <p>بيانات عملاء {currentOffice?.name} فقط</p>
        </div>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>الهوية</th>
                <th>رقم الجواز</th>
                <th>سجل الرحلات</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const trips = state.bookings
                  .filter((b) => b.customerId === c.id || (b.officeId === officeId && b.passengerName === c.name))
                  .map((b) => {
                    const trip = state.trips.find((t) => t.id === b.tripId)
                    return trip
                      ? `${getTripLabel(trip)} (مقعد ${b.seatNumber}) — ${formatMoney(b.price)}`
                      : null
                  })
                  .filter(Boolean)
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.nationalId}</td>
                    <td>{c.passportNumber || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {trips.length ? trips.join(' · ') : '—'}
                    </td>
                  </tr>
                )
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    لا يوجد عملاء بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
