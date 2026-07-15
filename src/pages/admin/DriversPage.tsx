import { useState } from 'react'
import { DRIVER_ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Driver, DriverRole } from '../../types'

const empty = {
  name: '',
  phone: '',
  licenseNumber: '',
  role: 'primary' as DriverRole,
  active: true,
}

export function DriversPage() {
  const { state, upsertDriver } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    upsertDriver(editId ? { ...form, id: editId } : form)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (d: Driver) => {
    setEditId(d.id)
    setForm({
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      role: d.role,
      active: d.active,
    })
    setOpen(true)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة السائقين</h1>
          <p>سائق رسمي أو معاون — التراخيص وبيانات التواصل</p>
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
          إضافة سائق
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>رقم الرخصة</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.drivers.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.phone}</td>
                  <td>{d.licenseNumber}</td>
                  <td>
                    <span
                      className={`badge ${d.role === 'primary' ? 'badge-info' : 'badge-warn'}`}
                    >
                      {DRIVER_ROLE_LABELS[d.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.active ? 'badge-ok' : 'badge-danger'}`}>
                      {d.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(d)}
                    >
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
            <h2>{editId ? 'تعديل سائق' : 'سائق جديد'}</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>الاسم</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الهاتف</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم الرخصة</label>
                  <input
                    required
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>النوع</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as DriverRole })}
                  >
                    <option value="primary">رسمي</option>
                    <option value="assistant">معاون</option>
                  </select>
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.active ? '1' : '0'}
                    onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
                  >
                    <option value="1">نشط</option>
                    <option value="0">موقوف</option>
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
