import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Bus, BusStatus } from '../../types'

const empty = {
  plateNumber: '',
  type: '',
  seats: 50,
  status: 'available' as BusStatus,
}

export function BusesPage() {
  const { state, upsertBus } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    upsertBus(editId ? { ...form, id: editId } : form)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (b: Bus) => {
    setEditId(b.id)
    setForm({
      plateNumber: b.plateNumber,
      type: b.type,
      seats: b.seats,
      status: b.status,
    })
    setOpen(true)
  }

  const statusLabel = (s: BusStatus) =>
    s === 'available' ? 'متاح' : s === 'maintenance' ? 'صيانة' : 'غير نشط'

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الباصات</h1>
          <p>اللوحات وأنواع الباصات وعدد المقاعد</p>
        </div>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => {
            setEditId(null)
            setForm(empty)
            setOpen(true)
          }}
        >
          إضافة باص
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>رقم اللوحة</th>
                <th>النوع</th>
                <th>المقاعد</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.buses.map((b) => (
                <tr key={b.id}>
                  <td>{b.plateNumber}</td>
                  <td>{b.type}</td>
                  <td>{b.seats}</td>
                  <td>
                    <span
                      className={`badge ${
                        b.status === 'available'
                          ? 'badge-ok'
                          : b.status === 'maintenance'
                            ? 'badge-warn'
                            : 'badge-danger'
                      }`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(b)}>
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل باص' : 'باص جديد'}</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>رقم اللوحة</label>
                  <input
                    required
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>النوع</label>
                  <input
                    required
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>عدد المقاعد</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BusStatus })}
                  >
                    <option value="available">متاح</option>
                    <option value="maintenance">صيانة</option>
                    <option value="inactive">غير نشط</option>
                  </select>
                </div>
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
