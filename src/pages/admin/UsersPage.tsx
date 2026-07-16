import { useState } from 'react'
import { ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Role, User } from '../../types'

const empty = {
  username: '',
  password: '',
  name: '',
  phone: '',
  role: 'office_manager' as Role,
  officeId: '' as string | null,
  active: true,
}

export function UsersPage() {
  const { state, upsertUser, deleteUser, isAdmin } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const users = isAdmin
    ? state.users
    : state.users.filter((u) => u.officeId === state.users.find((x) => x.id === state.currentUserId)?.officeId)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      officeId: form.role === 'admin' ? null : form.officeId || null,
    }
    if (payload.role !== 'admin' && !payload.officeId) {
      alert('يجب اختيار المكتب')
      return
    }
    upsertUser(editId ? { ...payload, id: editId } : payload)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (u: User) => {
    setEditId(u.id)
    setForm({
      username: u.username,
      password: u.password,
      name: u.name,
      phone: u.phone || '',
      role: u.role,
      officeId: u.officeId,
      active: u.active,
    })
    setOpen(true)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة المستخدمين</h1>
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
          مستخدم جديد
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الهاتف</th>
                <th>الدور</th>
                <th>المكتب</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.officeId ? state.offices.find((o) => o.id === u.officeId)?.name : '—'}</td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-ok' : 'badge-danger'}`}>
                      {u.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>
                        تعديل
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (confirm('حذف المستخدم؟')) deleteUser(u.id)
                          }}
                        >
                          حذف
                        </button>
                      )}
                    </div>
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
            <h2>{editId ? 'تعديل مستخدم' : 'مستخدم جديد'}</h2>
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
                  <label>اسم المستخدم</label>
                  <input
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم الهاتف</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="field">
                  <label>كلمة المرور</label>
                  <input
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الدور</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    {isAdmin && <option value="admin">مدير النظام</option>}
                    <option value="office_manager">مدير مكتب</option>
                    <option value="booking_clerk">موظف حجز</option>
                    <option value="accountant">محاسب</option>
                  </select>
                </div>
                {form.role !== 'admin' && (
                  <div className="field">
                    <label>المكتب</label>
                    <select
                      required
                      value={form.officeId ?? ''}
                      onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                    >
                      <option value="">اختر المكتب</option>
                      {state.offices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
