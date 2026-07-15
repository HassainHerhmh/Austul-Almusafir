import { useState } from 'react'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Trip, TripStatus, TripStop } from '../../types'
import { emptyStop, tripRoutePoints } from '../../utils/trip'

type TripForm = {
  busId: string
  driverId: string
  assistantDriverId: string
  date: string
  departureTime: string
  price: number
  status: TripStatus
  stops: TripStop[]
}

const emptyForm = (): TripForm => ({
  busId: '',
  driverId: '',
  assistantDriverId: '',
  date: todayStr(),
  departureTime: '08:00',
  price: 10000,
  status: 'scheduled',
  stops: [emptyStop(), emptyStop()],
})

export function TripsPage() {
  const { state, upsertTrip, cancelTrip, getTripLabel, getTripSeats, getBus, getDriver } =
    useApp()
  const [form, setForm] = useState<TripForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const updateStop = (index: number, patch: Partial<TripStop>) => {
    setForm((f) => ({
      ...f,
      stops: f.stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
    }))
  }

  const addStop = () => {
    setForm((f) => ({ ...f, stops: [...f.stops, emptyStop()] }))
  }

  const removeStop = (index: number) => {
    setForm((f) => {
      if (f.stops.length <= 2) return f
      return { ...f, stops: f.stops.filter((_, i) => i !== index) }
    })
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.stops.length < 2) {
      alert('أضف محطتين على الأقل')
      return
    }
    for (let i = 0; i < form.stops.length; i++) {
      const stop = form.stops[i]
      if (!stop.destinationId) {
        alert(`اختر الوجهة للمحطة ${i + 1}`)
        return
      }
      if (!stop.point.trim()) {
        alert(`أدخل نقطة الوقوف للمحطة ${i + 1}`)
        return
      }
    }
    for (let i = 1; i < form.stops.length; i++) {
      if (form.stops[i].destinationId === form.stops[i - 1].destinationId) {
        alert(`المحطتان ${i} و ${i + 1} متطابقتان`)
        return
      }
    }
    if (form.assistantDriverId && form.assistantDriverId === form.driverId) {
      alert('السائق الرسمي والمعاون يجب أن يكونا مختلفين')
      return
    }
    upsertTrip(
      editId
        ? {
            ...form,
            id: editId,
            assistantDriverId: form.assistantDriverId || null,
          }
        : {
            ...form,
            assistantDriverId: form.assistantDriverId || null,
          },
    )
    setOpen(false)
    setForm(emptyForm())
    setEditId(null)
  }

  const startEdit = (t: Trip) => {
    setEditId(t.id)
    setForm({
      busId: t.busId,
      driverId: t.driverId,
      assistantDriverId: t.assistantDriverId ?? '',
      date: t.date,
      departureTime: t.departureTime,
      price: t.price,
      status: t.status,
      stops: t.stops.map((s) => ({ ...s })),
    })
    setOpen(true)
  }

  const statusBadge = (s: TripStatus) => {
    if (s === 'scheduled') return <span className="badge badge-ok">مجدولة</span>
    if (s === 'cancelled') return <span className="badge badge-danger">ملغاة</span>
    if (s === 'departed') return <span className="badge badge-info">انطلقت</span>
    return <span className="badge badge-warn">مكتملة</span>
  }

  const stopLabel = (index: number, total: number) => {
    if (index === 0) return 'الانطلاق'
    if (index === total - 1) return 'الوصول'
    return `محطة ${index}`
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الرحلات</h1>
          <p>خط سير متسلسل: عدن ← عتق ← شرورة ← مكة</p>
        </div>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => {
            setEditId(null)
            setForm({
              ...emptyForm(),
              busId: state.buses[0]?.id ?? '',
              driverId: state.drivers.find((d) => d.role === 'primary')?.id ?? state.drivers[0]?.id ?? '',
              assistantDriverId:
                state.drivers.find((d) => d.role === 'assistant')?.id ?? '',
              stops: [
                emptyStop(state.destinations.find((d) => d.name === 'عدن')?.id ?? state.destinations[0]?.id ?? ''),
                emptyStop(state.destinations.find((d) => d.name === 'عتق')?.id ?? state.destinations[1]?.id ?? ''),
              ],
            })
            setOpen(true)
          }}
        >
          إنشاء رحلة
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>خط السير</th>
                <th>المحطات</th>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>الباص</th>
                <th>السائق الرسمي</th>
                <th>السائق المعاون</th>
                <th>السعر</th>
                <th>المقاعد</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...state.trips]
                .sort(
                  (a, b) =>
                    a.date.localeCompare(b.date) ||
                    a.departureTime.localeCompare(b.departureTime),
                )
                .map((t) => {
                  const seats = getTripSeats(t.id)
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{getTripLabel(t)}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {tripRoutePoints(t)}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{t.stops.length} محطة</span>
                      </td>
                      <td>{t.date}</td>
                      <td>{t.departureTime}</td>
                      <td>{getBus(t.busId)?.plateNumber}</td>
                      <td>{getDriver(t.driverId)?.name ?? '—'}</td>
                      <td>
                        {t.assistantDriverId
                          ? (getDriver(t.assistantDriverId)?.name ?? '—')
                          : '—'}
                      </td>
                      <td>{formatMoney(t.price)}</td>
                      <td>
                        {seats.booked}/{seats.total}
                        <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                          متبقي {seats.remaining}
                        </div>
                      </td>
                      <td>{statusBadge(t.status)}</td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => startEdit(t)}
                          >
                            تعديل
                          </button>
                          {t.status === 'scheduled' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (confirm('إلغاء الرحلة؟')) cancelTrip(t.id)
                              }}
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل رحلة' : 'رحلة جديدة'}</h2>
            <form onSubmit={save}>
              <div className="route-section">
                <div className="route-section-head">
                  <h3>خط السير (محطات متسلسلة)</h3>
                  <button type="button" className="btn btn-amber btn-sm" onClick={addStop}>
                    + محطة
                  </button>
                </div>

                <div className="stops-chain">
                  {form.stops.map((stop, index) => (
                    <div key={index} className="stop-block">
                      {index > 0 && (
                        <div className="stop-connector" aria-hidden>
                          ↓
                        </div>
                      )}
                      <div className="stop-card">
                        <div className="stop-card-head">
                          <span className="route-leg-title">
                            {stopLabel(index, form.stops.length)}
                          </span>
                          {form.stops.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => removeStop(index)}
                            >
                              حذف
                            </button>
                          )}
                        </div>
                        <div className="form-grid">
                          <div className="field">
                            <label>الوجهة</label>
                            <select
                              required
                              value={stop.destinationId}
                              onChange={(e) =>
                                updateStop(index, { destinationId: e.target.value })
                              }
                            >
                              <option value="">اختر المدينة</option>
                              {state.destinations.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>نقطة الوقوف</label>
                            <input
                              required
                              value={stop.point}
                              onChange={(e) => updateStop(index, { point: e.target.value })}
                              placeholder="مثل: موقف عدن"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" className="btn-add-stop" onClick={addStop}>
                    + إضافة محطة في المسار
                  </button>

                  <p className="route-preview">
                    {form.stops
                      .map(
                        (s) =>
                          state.destinations.find((d) => d.id === s.destinationId)?.name ?? '…',
                      )
                      .join(' ← ')}
                  </p>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '1rem' }}>
                <div className="field">
                  <label>التاريخ</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>وقت الانطلاق</label>
                  <input
                    type="time"
                    required
                    value={form.departureTime}
                    onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الباص</label>
                  <select
                    required
                    value={form.busId}
                    onChange={(e) => setForm({ ...form, busId: e.target.value })}
                  >
                    {state.buses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.plateNumber} ({b.seats} مقعد)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>السائق الرسمي</label>
                  <select
                    required
                    value={form.driverId}
                    onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  >
                    <option value="">اختر السائق الرسمي</option>
                    {state.drivers
                      .filter((d) => d.role === 'primary' && d.active)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label>السائق المعاون</label>
                  <select
                    value={form.assistantDriverId}
                    onChange={(e) => setForm({ ...form, assistantDriverId: e.target.value })}
                  >
                    <option value="">بدون معاون</option>
                    {state.drivers
                      .filter((d) => d.role === 'assistant' && d.active)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label>السعر</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
                {editId && (
                  <div className="field">
                    <label>الحالة</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as TripStatus })
                      }
                    >
                      <option value="scheduled">مجدولة</option>
                      <option value="departed">انطلقت</option>
                      <option value="completed">مكتملة</option>
                      <option value="cancelled">ملغاة</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">
                  حفظ
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
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
