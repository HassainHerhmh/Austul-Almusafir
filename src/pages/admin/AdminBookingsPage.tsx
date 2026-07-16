import { useMemo, useState } from 'react'
import { PAYMENT_LABELS, formatMoney } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Booking, PaymentMethod } from '../../types'

export function AdminBookingsPage() {
  const {
    state,
    getTripLabel,
    getOffice,
    getDestination,
    updateBooking,
    deleteBooking,
  } = useApp()

  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [editForm, setEditForm] = useState({
    passengerName: '',
    ticketNumber: '',
    passportNumber: '',
    visaTypeId: '',
    boardingDestinationId: '',
    arrivalDestinationId: '',
    seatNumber: 1,
    paymentMethod: 'cash' as PaymentMethod,
    notes: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editTrip = editBooking
    ? state.trips.find((t) => t.id === editBooking.tripId) ?? null
    : null

  const editRouteStops = useMemo(() => {
    if (!editTrip?.stops?.length) return []
    const seen = new Set<string>()
    return editTrip.stops.filter((s) => {
      if (!s.destinationId || seen.has(s.destinationId)) return false
      seen.add(s.destinationId)
      return true
    })
  }, [editTrip])

  const editBoardingStops =
    editRouteStops.length < 2 ? editRouteStops : editRouteStops.slice(0, -1)

  const editArrivalStops = useMemo(() => {
    if (!editRouteStops.length || !editForm.boardingDestinationId) return []
    const idx = editRouteStops.findIndex(
      (s) => s.destinationId === editForm.boardingDestinationId,
    )
    if (idx < 0) return editRouteStops.slice(1)
    return editRouteStops.slice(idx + 1)
  }, [editRouteStops, editForm.boardingDestinationId])

  const openEdit = (b: Booking) => {
    setEditBooking(b)
    setEditForm({
      passengerName: b.passengerName,
      ticketNumber: b.ticketNumber || '',
      passportNumber: b.passportNumber || '',
      visaTypeId: b.visaTypeId || '',
      boardingDestinationId: b.boardingDestinationId || '',
      arrivalDestinationId: b.arrivalDestinationId || '',
      seatNumber: b.seatNumber,
      paymentMethod: b.paymentMethod,
      notes: b.notes || '',
    })
    setEditError(null)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBooking) return
    if (!editForm.passengerName.trim()) {
      setEditError('اسم الراكب مطلوب')
      return
    }
    setBusy(true)
    setEditError(null)
    const err = await updateBooking(editBooking.id, {
      passengerName: editForm.passengerName.trim(),
      ticketNumber: editForm.ticketNumber.trim(),
      passportNumber: editForm.passportNumber.trim(),
      visaTypeId: editForm.visaTypeId,
      boardingDestinationId: editForm.boardingDestinationId,
      arrivalDestinationId: editForm.arrivalDestinationId,
      seatNumber: editForm.seatNumber,
      paymentMethod: editForm.paymentMethod,
      notes: editForm.notes.trim(),
    })
    setBusy(false)
    if (err) {
      setEditError(err)
      return
    }
    setEditBooking(null)
  }

  const cancelBooking = async (b: Booking) => {
    if (!confirm(`إلغاء تذكرة «${b.passengerName}»؟ سيتم حذف قيود المحاسبة المرتبطة.`)) return
    const err = await updateBooking(b.id, { status: 'cancelled' })
    if (err) alert(err)
  }

  const removeBooking = async (b: Booking) => {
    if (
      !confirm(
        `حذف تذكرة «${b.passengerName}» نهائياً؟ سيتم حذف قيود المحاسبة والسندات المرتبطة.`,
      )
    ) {
      return
    }
    const err = await deleteBooking(b.id)
    if (err) alert(err)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>متابعة الحجوزات</h1>
          <p>تعديل · إلغاء · حذف — الإلغاء والحذف يحذفان قيود المحاسبة</p>
        </div>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>رقم التذكرة</th>
                <th>رقم الجواز</th>
                <th>نوع التأشيرة</th>
                <th>منطقة الانطلاق</th>
                <th>منطقة الوصول</th>
                <th>المقعد</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>تاريخ الحجز</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th>الملاحظات</th>
                <th></th>
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
                      <td>{b.ticketNumber || '—'}</td>
                      <td>{b.passportNumber || '—'}</td>
                      <td>{state.visaTypes.find((v) => v.id === b.visaTypeId)?.name || '—'}</td>
                      <td>{getDestination(b.boardingDestinationId)?.name || '—'}</td>
                      <td>{getDestination(b.arrivalDestinationId)?.name || '—'}</td>
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
                      <td>
                        <div className="actions">
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEdit(b)}
                            >
                              تعديل
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => void cancelBooking(b)}
                            >
                              إلغاء
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void removeBooking(b)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              {state.bookings.length === 0 && (
                <tr>
                  <td colSpan={14} className="empty">
                    لا توجد حجوزات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editBooking && (
        <div className="modal-backdrop" onClick={() => setEditBooking(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>تعديل التذكرة</h2>
            <form onSubmit={(e) => void saveEdit(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>اسم الراكب</label>
                  <input
                    required
                    value={editForm.passengerName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, passengerName: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>رقم التذكرة</label>
                  <input
                    value={editForm.ticketNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, ticketNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>رقم الجواز</label>
                  <input
                    value={editForm.passportNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, passportNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>نوع التأشيرة</label>
                  <select
                    value={editForm.visaTypeId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, visaTypeId: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {state.visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>المقعد</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.seatNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        seatNumber: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>طريقة الدفع</label>
                  <select
                    value={editForm.paymentMethod}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        paymentMethod: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    <option value="cash">{PAYMENT_LABELS.cash}</option>
                    <option value="transfer">{PAYMENT_LABELS.transfer}</option>
                    <option value="credit">{PAYMENT_LABELS.credit}</option>
                  </select>
                </div>
                <div className="field">
                  <label>منطقة الانطلاق</label>
                  <select
                    required
                    value={editForm.boardingDestinationId}
                    onChange={(e) => {
                      const boardId = e.target.value
                      const idx = editRouteStops.findIndex((s) => s.destinationId === boardId)
                      const nextArrivals =
                        idx < 0 ? editRouteStops.slice(1) : editRouteStops.slice(idx + 1)
                      setEditForm((f) => ({
                        ...f,
                        boardingDestinationId: boardId,
                        arrivalDestinationId:
                          nextArrivals[nextArrivals.length - 1]?.destinationId ?? '',
                      }))
                    }}
                  >
                    {editBoardingStops.map((s) => (
                      <option key={s.destinationId} value={s.destinationId}>
                        {getDestination(s.destinationId)?.name ?? s.destinationId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>منطقة الوصول</label>
                  <select
                    required
                    value={editForm.arrivalDestinationId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, arrivalDestinationId: e.target.value }))
                    }
                  >
                    {editArrivalStops.map((s) => (
                      <option key={s.destinationId} value={s.destinationId}>
                        {getDestination(s.destinationId)?.name ?? s.destinationId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>الملاحظات</label>
                  <input
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              {editError && <p className="error-msg">{editError}</p>}
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'جاري الحفظ…' : 'حفظ'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditBooking(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
