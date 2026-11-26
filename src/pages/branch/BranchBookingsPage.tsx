import { useMemo, useState } from 'react'
import { TlbConfirmUploadButton } from '../../components/TlbConfirmUploadButton'
import { PAYMENT_LABELS, formatMoney } from '../../components/utils'
import { useApp } from '../../context/AppContext'

export function BranchBookingsPage() {
  const { state, currentBranch, getTripLabel, getOffice, refreshBookings } = useApp()
  const branchOffices = useMemo(
    () => state.offices.filter((o) => o.branchId === currentBranch?.id),
    [state.offices, currentBranch?.id],
  )
  const officeIds = useMemo(() => new Set(branchOffices.map((o) => o.id)), [branchOffices])
  const [officeFilter, setOfficeFilter] = useState('')

  const rows = useMemo(() => {
    let list = state.bookings.filter((b) => officeIds.has(b.officeId))
    if (officeFilter) list = list.filter((b) => b.officeId === officeFilter)
    return [...list].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
  }, [state.bookings, officeIds, officeFilter])

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>حجوزات الفرع</h1>
        </div>
        <h3 className="field" style={{ margin: 0, minWidth: 200 }}>
          <label className="sr-only">المكتب</label>
          <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
            <option value="">كل المكاتب</option>
            {branchOffices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </h3>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>السعر</th>
                <th>الدفع</th>
                <th>الحالة</th>
                <th>تاريخ الحجز</th>
                <th>رفع للهيئة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                return (
                  <tr key={b.id}>
                    <td>{b.passengerName}</td>
                    <td>{getOffice(b.officeId)?.name ?? '—'}</td>
                    <td>{trip ? getTripLabel(trip) : '—'}</td>
                    <td>{b.seatNumber}</td>
                    <td>{formatMoney(b.price)}</td>
                    <td>{PAYMENT_LABELS[b.paymentMethod]}</td>
                    <td>
                      <span
                        className={`badge ${b.status === 'confirmed' ? 'badge-ok' : 'badge-danger'}`}
                      >
                        {b.status === 'confirmed' ? 'مؤكد' : b.status === 'cancelled' ? 'ملغى' : b.status}
                      </span>
                    </td>
                    <td>{b.bookedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      <TlbConfirmUploadButton
                        booking={b}
                        onSuccess={() => void refreshBookings()}
                      />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    لا توجد حجوزات
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