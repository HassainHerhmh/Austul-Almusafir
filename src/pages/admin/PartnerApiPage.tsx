import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../api/client'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'

type PartnerPerms = {
  bookingsCreate: boolean
  bookingsUpdate: boolean
  bookingsCancel: boolean
  bookingsDelete: boolean
  bookingsList: boolean
  seatsView: boolean
}

type PartnerKeyRow = {
  id: string
  name: string
  officeId: string
  officeName: string
  keyPrefix: string
  permissions: PartnerPerms
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

const PERM_LABELS: { key: keyof PartnerPerms; label: string }[] = [
  { key: 'bookingsCreate', label: 'إضافة حجز' },
  { key: 'bookingsUpdate', label: 'تعديل حجز' },
  { key: 'bookingsCancel', label: 'إلغاء حجز' },
  { key: 'bookingsDelete', label: 'حذف حجز' },
  { key: 'bookingsList', label: 'عرض حجوزات المكتب' },
  { key: 'seatsView', label: 'عرض المتبقي والمقاعد المحجوزة' },
]

const emptyPerms = (): PartnerPerms => ({
  bookingsCreate: true,
  bookingsUpdate: true,
  bookingsCancel: true,
  bookingsDelete: false,
  bookingsList: true,
  seatsView: true,
})

export function PartnerApiPage() {
  const { state } = useApp()
  const [list, setList] = useState<PartnerKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [active, setActive] = useState(true)
  const [permissions, setPermissions] = useState<PartnerPerms>(emptyPerms)
  const [saving, setSaving] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const baseUrl = `${API_BASE}/api/partner/v1`

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await serverApi.partnerKeys.list()
      setList((res.list ?? []) as PartnerKeyRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الروابط')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const resetForm = () => {
    setEditId(null)
    setName('')
    setOfficeId(state.offices.find((o) => o.status === 'active')?.id ?? '')
    setActive(true)
    setPermissions(emptyPerms())
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const openEdit = (row: PartnerKeyRow) => {
    setEditId(row.id)
    setName(row.name)
    setOfficeId(row.officeId)
    setActive(row.active)
    setPermissions({ ...row.permissions })
    setError(null)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    resetForm()
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || name.trim().length < 2) {
      setError('أدخل اسم الجهة')
      return
    }
    if (!officeId) {
      setError('اختر المكتب')
      return
    }
    setSaving(true)
    try {
      if (editId) {
        await serverApi.partnerKeys.update(editId, {
          name: name.trim(),
          officeId,
          permissions,
          active,
        })
        closeModal()
        await refresh()
      } else {
        const res = await serverApi.partnerKeys.create({
          name: name.trim(),
          officeId,
          permissions,
          active,
        })
        setCreatedKey(res.apiKey)
        closeModal()
        await refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: PartnerKeyRow) => {
    try {
      await serverApi.partnerKeys.update(row.id, { active: !row.active })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'تعذر تغيير الحالة')
    }
  }

  const remove = async (row: PartnerKeyRow) => {
    if (!confirm(`حذف رابط «${row.name}»؟ لن تستطيع الجهة استخدام المفتاح بعد الحذف.`)) return
    try {
      await serverApi.partnerKeys.remove(row.id)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'تعذر الحذف')
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('تعذر النسخ — انسخ يدوياً')
    }
  }

  const offices = [...state.offices].sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>ربط API</h1>
          <p>
            أنشئ مفتاحاً سرياً لجهة خارجية مربوطة بمكتب — تستدعي به واجهات الحجوزات فقط حسب الصلاحيات
            المحددة.
          </p>
        </div>
        <button type="button" className="btn btn-amber" onClick={openCreate}>
          رابط جديد
        </button>
      </header>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-head">
          <h2>عنوان الأساس للجهة</h2>
        </div>
        <div className="actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <code style={{ direction: 'ltr', fontSize: 13 }}>{baseUrl}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyText(baseUrl)}>
            نسخ
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 8 }}>
          المصادقة: <code style={{ direction: 'ltr' }}>Authorization: Bearer &lt;apiKey&gt;</code>
        </p>
      </div>

      {error && !open && <p className="error-msg">{error}</p>}

      <div className="panel">
        <div className="panel-head">
          <h2>الروابط ({list.length})</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الجهة</th>
                <th>المكتب</th>
                <th>البادئة</th>
                <th>الصلاحيات</th>
                <th>آخر استخدام</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const perms = PERM_LABELS.filter((p) => row.permissions[p.key]).map((p) => p.label)
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.officeName || '—'}</td>
                    <td>
                      <code style={{ direction: 'ltr' }}>{row.keyPrefix}_…</code>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{perms.length ? perms.join(' · ') : '—'}</td>
                    <td>
                      {row.lastUsedAt
                        ? row.lastUsedAt.slice(0, 19).replace('T', ' ')
                        : 'لم يُستخدم'}
                    </td>
                    <td>
                      <span className={`badge ${row.active ? 'badge-ok' : 'badge-danger'}`}>
                        {row.active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void toggleActive(row)}
                        >
                          {row.active ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void remove(row)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    لا توجد روابط بعد — أنشئ رابطاً للجهة الخارجية
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="empty">
                    جاري التحميل…
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
            <h2>{editId ? 'تعديل رابط API' : 'رابط API جديد'}</h2>
            <form onSubmit={save}>
              {error && <p className="error-msg">{error}</p>}
              <div className="form-grid">
                <div className="field">
                  <label>اسم الجهة</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: منصة الحجوزات س"
                  />
                </div>
                <div className="field">
                  <label>المكتب المرتبط</label>
                  <select required value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
                    <option value="">اختر المكتب</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.status !== 'active' ? ' (موقوف)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={active ? '1' : '0'}
                    onChange={(e) => setActive(e.target.value === '1')}
                  >
                    <option value="1">نشط</option>
                    <option value="0">موقوف</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <strong>الصلاحيات</strong>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {PERM_LABELS.map((p) => (
                    <label
                      key={p.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={permissions[p.key]}
                        onChange={(e) =>
                          setPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ…' : 'حفظ'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdKey && (
        <div className="modal-backdrop" onClick={() => setCreatedKey(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>المفتاح السري — انسخه الآن</h2>
            <p className="error-msg" style={{ color: 'var(--danger)' }}>
              لن يظهر المفتاح مرة أخرى بعد إغلاق هذه النافذة.
            </p>
            <div
              style={{
                background: 'var(--panel-2, #f1f5f9)',
                padding: 12,
                borderRadius: 10,
                direction: 'ltr',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            >
              {createdKey}
            </div>
            <div className="actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void copyText(createdKey)}
              >
                {copied ? 'تم النسخ' : 'نسخ المفتاح'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreatedKey(null)}>
                تم
              </button>
            </div>
            <p style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--muted)' }}>
              العنوان: <code style={{ direction: 'ltr' }}>{baseUrl}</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
