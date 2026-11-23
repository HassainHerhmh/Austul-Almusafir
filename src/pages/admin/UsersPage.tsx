import { useMemo, useState } from 'react'
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
  branchId: '' as string | null,
  driverId: '' as string | null,
  active: true,
}

export function UsersPage() {
  const { state, upsertUser, deleteUser, isAdmin, isBranchAdmin, currentBranch, currentUser } =
    useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const branchOfficeIds = useMemo(() => {
    if (!isBranchAdmin || !currentBranch) return null
    return new Set(
      state.offices.filter((o) => o.branchId === currentBranch.id).map((o) => o.id),
    )
  }, [isBranchAdmin, currentBranch, state.offices])

  const users = useMemo(() => {
    if (isAdmin) return state.users
    if (isBranchAdmin && currentBranch) {
      return state.users.filter((u) => {
        if (u.role === 'branch_admin' && u.branchId === currentBranch.id) return true
        if (u.officeId && branchOfficeIds?.has(u.officeId)) return true
        return false
      })
    }
    return state.users.filter((u) => u.officeId === currentUser?.officeId)
  }, [state.users, isAdmin, isBranchAdmin, currentBranch, currentUser?.officeId, branchOfficeIds])

  const officesForForm = useMemo(() => {
    if (isBranchAdmin && currentBranch) {
      return state.offices.filter((o) => o.branchId === currentBranch.id)
    }
    if (isAdmin) return state.offices
    return state.offices.filter((o) => o.id === currentUser?.officeId)
  }, [state.offices, isAdmin, isBranchAdmin, currentBranch, currentUser?.officeId])

  const linkedDriverIds = new Set(
    state.users
      .filter((u) => u.driverId && u.id !== editId)
      .map((u) => u.driverId as string),
  )

  const closeModal = () => {
    setOpen(false)
    setForm(empty)
    setEditId(null)
    setError(null)
    setSaving(false)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const isDriver = form.role === 'driver'
    const username = form.username.trim()
    const name = form.name.trim()
    const password = form.password.trim()

    if (username.length < 2) {
      setError('اسم المستخدم يجب أن يكون حرفين على الأقل')
      return
    }
    if (!name) {
      setError('الاسم مطلوب')
      return
    }
    if (!editId && password.length < 4) {
      setError('كلمة المرور مطلوبة (4 أحرف على الأقل)')
      return
    }
    if (editId && password && password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل')
      return
    }

    const isBranchAdminRole = form.role === 'branch_admin'
    const payload = {
      username,
      password,
      name,
      phone: form.phone.trim(),
      role: form.role,
      officeId:
        form.role === 'admin' || isDriver || isBranchAdminRole ? null : form.officeId || null,
      branchId: isBranchAdminRole ? form.branchId || null : null,
      driverId: isDriver ? form.driverId || null : null,
      active: form.active,
    }
  if (isBranchAdminRole && !payload.branchId) {
      setError('يجب اختيار الفرع')
      return
    }
    if (!isDriver && payload.role !== 'admin' && !isBranchAdminRole && !payload.officeId) {
      setError('يجب اختيار المكتب')
      return
    }
    if (isDriver && !payload.driverId) {
      setError('يجب اختيار السائق المرتبط بحساب التتبع')
      return
    }

    setSaving(true)
    try {
      await upsertUser(editId ? { ...payload, id: editId } : payload)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المستخدم')
      setSaving(false)
    }
  }

  const startEdit = (u: User) => {
    setEditId(u.id)
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      phone: u.phone || '',
      role: u.role,
      officeId: u.officeId,
      branchId: u.branchId ?? '',
      driverId: u.driverId,
      active: u.active,
    })
    setError(null)
    setOpen(true)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة المستخدمين</h1>
          <p>حسابات السائقين تُستخدم لتطبيق تتبع الباص (APK)</p>
        </div>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => {
            setEditId(null)
            setForm(empty)
            setError(null)
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
                <th>المكتب / السائق</th>
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
                  <td>
                    {u.role === 'driver'
                      ? state.drivers.find((d) => d.id === u.driverId)?.name || '—'
                      : u.role === 'branch_admin'
                        ? state.branches.find((b) => b.id === u.branchId)?.name || '—'
                        : u.officeId
                          ? state.offices.find((o) => o.id === u.officeId)?.name
                          : '—'}
                  </td>
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
                            if (confirm('حذف المستخدم؟')) void deleteUser(u.id)
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
              {error && <p className="error-msg">{error}</p>}
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
                    required={!editId}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editId ? 'اتركها فارغة للإبقاء' : ''}
                  />
                </div>
                <div className="field">
                  <label>الدور</label>
                  <select
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value as Role
                      setForm({
                        ...form,
                        role,
                        officeId:
                          role === 'admin' || role === 'driver' || role === 'branch_admin'
                            ? null
                            : form.officeId,
                        branchId: role === 'branch_admin' ? form.branchId : null,
                        driverId: role === 'driver' ? form.driverId : null,
                      })
                    }}
                  >
                    {isAdmin && <option value="admin">مدير النظام</option>}
                    {isAdmin && <option value="branch_admin">مدير فرع</option>}
                    <option value="office_manager">مدير مكتب</option>
                    <option value="booking_clerk">موظف حجز</option>
                    <option value="accountant">محاسب</option>
                    {isAdmin && <option value="driver">سائق (تتبع)</option>}
                  </select>
                </div>
                {form.role === 'branch_admin' && isAdmin && (
                  <div className="field">
                    <label>الفرع</label>
                    <select
                      required
                      value={form.branchId ?? ''}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    >
                      <option value="">اختر الفرع</option>
                      {state.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {form.role !== 'admin' && form.role !== 'driver' && form.role !== 'branch_admin' && (
                  <div className="field">
                    <label>المكتب</label>
                    <select
                      required
                      value={form.officeId ?? ''}
                      onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                    >
                      <option value="">اختر المكتب</option>
                      {officesForForm.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {form.role === 'driver' && isAdmin && (
                  <div className="field">
                    <label>السائق المرتبط</label>
                    <select
                      required
                      value={form.driverId ?? ''}
                      onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                    >
                      <option value="">اختر السائق</option>
                      {state.drivers
                        .filter((d) => d.active || d.id === form.driverId)
                        .map((d) => (
                          <option
                            key={d.id}
                            value={d.id}
                            disabled={linkedDriverIds.has(d.id)}
                          >
                            {d.name}
                            {linkedDriverIds.has(d.id) ? ' (مربوط مسبقاً)' : ''}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
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
