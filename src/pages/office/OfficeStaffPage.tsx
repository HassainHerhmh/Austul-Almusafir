import { useState } from 'react'
import { ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Role, User } from '../../types'

const emptyForm = {
  name: '',
  username: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'booking_clerk' as Role,
  active: true,
}

export function OfficeStaffPage() {
  const { state, currentOffice, currentUser, can, canPage, upsertUser, deleteUser } = useApp()
  const officeId = currentOffice!.id

  const staff = state.users.filter((u) => u.officeId === officeId)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  if (!can('manage_office_users') && !canPage('staff', 'view')) {
    return (
      <div className="panel">
        <div className="empty">فقط مدير المكتب يمكنه إدارة الموظفين</div>
      </div>
    )
  }

  const closeModal = () => {
    setOpen(false)
    setEditId(null)
    setForm(emptyForm)
    setError(null)
  }

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  const openEdit = (u: User) => {
    setEditId(u.id)
    setForm({
      name: u.name,
      username: u.username,
      phone: u.phone || '',
      password: '',
      confirmPassword: '',
      role: u.role,
      active: u.active,
    })
    setError(null)
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.role === 'admin') return

    if (!editId) {
      if (!form.password || form.password.length < 4) {
        setError('كلمة المرور مطلوبة (4 أحرف على الأقل)')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('كلمة المرور غير متطابقة')
        return
      }
    } else if (form.password) {
      if (form.password.length < 4) {
        setError('كلمة المرور قصيرة جداً')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('كلمة المرور غير متطابقة')
        return
      }
    }

    try {
      await upsertUser({
        ...(editId ? { id: editId } : {}),
        name: form.name,
        username: form.username,
        phone: form.phone.trim(),
        password: form.password || '',
        role: form.role,
        officeId,
        driverId: null,
        active: form.active,
      })
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الموظف')
    }
  }

  const toggleActive = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('لا يمكن تعطيل حسابك الحالي')
      return
    }
    try {
      await upsertUser({
        ...u,
        password: '',
        active: !u.active,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'تعذر تغيير الحالة')
    }
  }

  const remove = async (u: User) => {
    if (u.id === currentUser?.id) return
    if (!confirm(`هل تريد حذف الموظف "${u.name}"؟`)) return
    try {
      await deleteUser(u.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'تعذر الحذف')
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>موظفو المكتب</h1>
        </div>
        {(canPage('staff', 'add') || can('manage_office_users')) && (
          <button type="button" className="btn btn-amber" onClick={openAdd}>
            إضافة موظف
          </button>
        )}
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
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-ok' : 'badge-danger'}`}>
                      {u.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      {(canPage('staff', 'edit') || can('manage_office_users')) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(u)}
                        >
                          تعديل
                        </button>
                      )}
                      {u.id !== currentUser?.id &&
                        (canPage('staff', 'edit') || can('manage_office_users')) && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void toggleActive(u)}
                          >
                            {u.active ? 'تعطيل' : 'تفعيل'}
                          </button>
                        )}
                      {u.id !== currentUser?.id &&
                        (canPage('staff', 'delete') || can('manage_office_users')) && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void remove(u)}
                          >
                            حذف
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    لا يوجد موظفون بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل موظف' : 'موظف جديد'}</h2>
            <form onSubmit={(e) => void save(e)}>
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
                  <label>رقم هاتف الموظف</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="field">
                  <label>{editId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label>
                  <input
                    type="password"
                    required={!editId}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label>تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    required={!editId || !!form.password}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label>الدور</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    <option value="office_manager">مدير مكتب</option>
                    <option value="booking_clerk">موظف حجز</option>
                    <option value="accountant">محاسب</option>
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
              {error && <p className="error-msg">{error}</p>}
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">
                  حفظ
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
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
