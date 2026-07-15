import { useState } from 'react'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { PricingMode, Trip, TripStatus, TripStop } from '../../types'
import { emptyStop, tripRoutePoints } from '../../utils/trip'

type TripForm = {
  busId: string
  driverId: string
  assistantName: string
  assistantPhone: string
  pricingMode: PricingMode
  date: string
  departureTime: string
  price: number
  status: TripStatus
  stops: TripStop[]
}

const emptyForm = (): TripForm => ({
  busId: '',
  driverId: '',
  assistantName: '',
  assistantPhone: '',
  pricingMode: 'trip',
  date: todayStr(),
  departureTime: '08:00',
  price: 10000,
  status: 'scheduled',
  stops: [emptyStop(), emptyStop()],
})

export function TripsPage() {
  const { state, upsertTrip, cancelTrip, openTrip, closeTrip, reopenTrip, getTripLabel, getTripSeats, getBus, getDriver } =
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
    }
    for (let i = 1; i < form.stops.length; i++) {
      if (form.stops[i].destinationId === form.stops[i - 1].destinationId) {
        alert(`المحطتان ${i} و ${i + 1} متطابقتان`)
        return
      }
    }
    if (form.assistantPhone.trim() && !form.assistantName.trim()) {
      alert('أدخل اسم السائق المعاون مع رقم الجوال')
      return
    }
    if (form.pricingMode === 'trip' && !(form.price > 0)) {
      alert('أدخل سعر التذكرة للرحلة')
      return
    }
    upsertTrip(
      editId
        ? {
            ...form,
            id: editId,
            assistantName: form.assistantName.trim(),
            assistantPhone: form.assistantPhone.trim(),
          }
        : {
            ...form,
            assistantName: form.assistantName.trim(),
            assistantPhone: form.assistantPhone.trim(),
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
      assistantName: t.assistantName ?? '',
      assistantPhone: t.assistantPhone ?? '',
      pricingMode: t.pricingMode === 'boarding' ? 'boarding' : 'trip',
      date: t.date,
      departureTime: t.departureTime,
      price: t.price,
      status: t.status,
      stops: t.stops.map((s) => ({ ...s })),
    })
    setOpen(true)
  }

  const statusBadge = (s: TripStatus) => {
    if (s === 'scheduled') return <span className="badge badge-info">مجدولة</span>
    if (s === 'open') return <span className="badge badge-ok">مفتوحة</span>
    if (s === 'closed') return <span className="badge badge-warn">مقفلة</span>
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
                <th>النوع</th>
                <th>موديل الحافلة</th>
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
                      <td>
                        {getBus(t.busId)?.busNumber
                          ? `${getBus(t.busId)!.busNumber} — ${getBus(t.busId)!.plateNumber}`
                          : getBus(t.busId)?.plateNumber}
                      </td>
                      <td>{getBus(t.busId)?.type || '—'}</td>
                      <td>{getBus(t.busId)?.year || '—'}</td>
                      <td>{getDriver(t.driverId)?.name ?? '—'}</td>
                      <td>
                        {t.assistantName
                          ? `${t.assistantName}${t.assistantPhone ? ` — ${t.assistantPhone}` : ''}`
                          : '—'}
                      </td>
                      <td>
                        {t.pricingMode === 'boarding'
                          ? 'حسب الصعود'
                          : formatMoney(t.price)}
                      </td>
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
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  if (!confirm('فتح الرحلة للحجز عند الوكلاء؟')) return
                                  void openTrip(t.id).catch((err: unknown) => {
                                    alert(err instanceof Error ? err.message : 'تعذر فتح الرحلة')
                                  })
                                }}
                              >
                                فتح
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  if (!confirm('إلغاء الرحلة؟')) return
                                  void cancelTrip(t.id).catch((err: unknown) => {
                                    alert(err instanceof Error ? err.message : 'تعذر إلغاء الرحلة')
                                  })
                                }}
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                          {t.status === 'open' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-amber btn-sm"
                                onClick={() => {
                                  if (
                                    !confirm(
                                      'إقفال الرحلة؟ لن يتمكن الوكلاء من الحجز عليها بعد الإقفال.',
                                    )
                                  )
                                    return
                                  void closeTrip(t.id).catch((err: unknown) => {
                                    alert(err instanceof Error ? err.message : 'تعذر إقفال الرحلة')
                                  })
                                }}
                              >
                                إقفال
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  if (!confirm('إلغاء الرحلة؟')) return
                                  void cancelTrip(t.id).catch((err: unknown) => {
                                    alert(err instanceof Error ? err.message : 'تعذر إلغاء الرحلة')
                                  })
                                }}
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                          {(t.status === 'closed' || t.status === 'departed') && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                if (!confirm('إعادة فتح الرحلة للحجز؟')) return
                                void reopenTrip(t.id).catch((err: unknown) => {
                                  alert(err instanceof Error ? err.message : 'تعذر إعادة الفتح')
                                })
                              }}
                            >
                              إعادة فتح
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
                        {[b.busNumber, b.plateNumber, b.type, b.year]
                          .filter(Boolean)
                          .join(' — ')}{' '}
                        ({b.seats} مقعد)
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
                  <label>اسم السائق المعاون</label>
                  <input
                    value={form.assistantName}
                    onChange={(e) => setForm({ ...form, assistantName: e.target.value })}
                    placeholder="اختياري"
                  />
                </div>
                <div className="field">
                  <label>جوال المعاون</label>
                  <input
                    value={form.assistantPhone}
                    onChange={(e) => setForm({ ...form, assistantPhone: e.target.value })}
                    placeholder="رقم الجوال"
                    inputMode="tel"
                  />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>تسعيرة الرحلة</label>
                  <div className="actions" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn ${form.pricingMode === 'trip' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setForm({ ...form, pricingMode: 'trip' })}
                    >
                      حسب الرحلة
                    </button>
                    <button
                      type="button"
                      className={`btn ${form.pricingMode === 'boarding' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setForm({ ...form, pricingMode: 'boarding' })}
                    >
                      حسب منطقة الصعود
                    </button>
                  </div>
                </div>
                {form.pricingMode === 'trip' && (
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
                )}
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
                      <option value="open">مفتوحة</option>
                      <option value="closed">مقفلة</option>
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
