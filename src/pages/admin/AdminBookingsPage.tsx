import { formatMoney } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function AdminBookingsPage() {
  const { state, getTripLabel, getOffice } = useApp()

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>متابعة الحجوزات</h1>
          <p>جميع حجوزات المكاتب على النظام المركزي</p>
        </div>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>رقم الجواز</th>
                <th>المقعد</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>تاريخ الحجز</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {[...state.bookings]
                .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
                .map((b) => {
                  const trip = state.trips.find((t) => t.id === b.tripId)
                  return (
                    <tr key={b.id}>
                      <td>{b.passengerName}</td>
                      <td>{b.passportNumber || '—'}</td>
                      <td>{b.seatNumber}</td>
                      <td>{getOffice(b.officeId)?.name}</td>
                      <td>{trip ? getTripLabel(trip) : '—'}</td>
                      <td>{b.bookedAt.slice(0, 16).replace('T', ' ')}</td>
                      <td>
                        <span
                          className={`badge ${
                            b.status === 'confirmed' ? 'badge-ok' : 'badge-danger'
                          }`}
                        >
                          {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                        </span>
                      </td>
                      <td>{formatMoney(b.price)}</td>
                      <td>{b.notes?.trim() ? b.notes : '—'}</td>
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
