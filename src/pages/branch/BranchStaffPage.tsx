import { useMemo, useState } from 'react'
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
  officeId: '',
  active: true,
}

export function BranchStaffPage() {
  const { state, currentBranch, upsertUser, deleteUser } = useApp()
  const branchOffices = useMemo(
    () => state.offices.filter((o) => o.branchId === currentBranch?.id),
    [state.offices, currentBranch?.id],
  )
  const officeIds = useMemo(() => new Set(branchOffices.map((o) => o.id)), [branchOffices])
  const staff = useMemo(
    () => state.users.filter((u) => u.officeId && officeIds.has(u.officeId)),
    [state.users, officeIds],
  )

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const closeModal = () => {
    setOpen(false)
    setEditId(null)
    setForm(emptyForm)
    setError(null)
  }

  const openAdd = () => {
    setEditId(null)
    setForm({
      ...emptyForm,
      officeId: branchOffices[0]?.id ?? '',
    })
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
      officeId: u.officeId ?? '',
      active: u.active,
    })
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.officeId) {
      setError('اختر المكتب')
      return
    }
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
      if (form.password.length < 4 || form.password !== form.confirmPassword) {
        setError('تحقق من كلمة المرور')
        return
      }
    }

    try {
      await upsertUser({
        id: editId ?? undefined,
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        officeId: form.officeId,
        driverId: null,
        active: form.active,
      })
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ')
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>موظفو الفرع</h1>
        </div>
        <button type="button" className="btn btn-amber" onClick={openAdd} disabled={!branchOffices.length}>
          موظف جديد
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المستخدم</th>
                <th>المكتب</th>
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
                  <td>{branchOffices.find((o) => o.id === u.officeId)?.name ?? '—'}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-ok' : 'badge-danger'}`}>
                      {u.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm('حذف المستخدم؟')) void deleteUser(u.id)
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    لا يوجد موظفون
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
              {error && <p className="error-msg">{error}</p>}
              <div className="form-grid">
                <div className="field">
                  <label>الاسم</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                  <label>الهاتف</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>المكتب</label>
                  <select
                    required
                    value={form.officeId}
                    onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                  >
                    {branchOffices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
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
                  <label>كلمة المرور</label>
                  <input
                    type="password"
                    required={!editId}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editId ? 'اتركها فارغة للإبقاء' : ''}
                  />
                </div>
                <div className="field">
                  <label>تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    required={!editId || !!form.password}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  />
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