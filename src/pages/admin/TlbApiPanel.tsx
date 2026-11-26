import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { serverApi } from '../../api/serverApi'

type TlbPerms = {
  passengerSend: boolean
  autoOnBooking: boolean
  useHmacSignature: boolean
}

type TlbRow = {
  apiId: number
  companyId: string
  apiNAme: string
  apiKeyMasked: string
  apiSecretMasked: string
  apiBaseUrl: string
  isActive: number
  permissions: TlbPerms
  createdAt: string
  updatedAt: string
}

const PERM_LABELS: { key: keyof TlbPerms; label: string }[] = [
  { key: 'passengerSend', label: 'إرسال passenger' },
  { key: 'autoOnBooking', label: 'إرسال تلقائي عند التذكرة (غير موصى به)' },
  {
    key: 'useHmacSignature',
    label: 'توقيع HMAC (X-Signature) — مطلوب على سيرفر الهيئة',
  },
]

const DEFAULT_PERMS: TlbPerms = {
  passengerSend: true,
  autoOnBooking: true,
  useHmacSignature: true,
}

const DEFAULT_BASE = 'https://apicomny-001-site1.htempurl.com/'

export function TlbApiPanel() {
  const [list, setList] = useState<TlbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [apiNAme, setApiNAme] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_BASE)
  const [isActive, setIsActive] = useState(1)
  const [permissions, setPermissions] = useState<TlbPerms>(DEFAULT_PERMS)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await serverApi.tlbApiKeys.list()
      setList((res.list ?? []) as TlbRow[])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذر تحميل إعدادات الهيئة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const reset = () => {
    setEditId(null)
    setCompanyId('')
    setApiNAme('')
    setApiKey('')
    setApiSecret('')
    setApiBaseUrl(DEFAULT_BASE)
    setIsActive(1)
    setPermissions(DEFAULT_PERMS)
    setErr(null)
  }

  const openCreate = () => {
    reset()
    setOpen(true)
  }

  const openEdit = (row: TlbRow) => {
    setEditId(row.apiId)
    setCompanyId(row.companyId)
    setApiNAme(row.apiNAme)
    setApiKey('')
    setApiSecret('')
    setApiBaseUrl(row.apiBaseUrl || DEFAULT_BASE)
    setIsActive(row.isActive)
    setPermissions({ ...row.permissions })
    setErr(null)
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId.trim()) return
    if (!editId && (!apiKey.trim() || !apiSecret.trim())) {
      setErr('أدخل ApiKey و ApiSecret')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const payload = {
        companyId: companyId.trim(),
        apiNAme: apiNAme.trim(),
        apiBaseUrl: apiBaseUrl.trim(),
        isActive,
        permissions,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
      }
      if (editId) {
        await serverApi.tlbApiKeys.update(String(editId), payload)
      } else {
        await serverApi.tlbApiKeys.create({
          ...payload,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        })
      }
      setOpen(false)
      reset()
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: TlbRow) => {
    if (!confirm(`حذف إعدادات «${row.apiNAme || row.companyId}»؟`)) return
    try {
      await serverApi.tlbApiKeys.remove(String(row.apiId))
      await refresh()
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'تعذر الحذف')
    }
  }

  const modal =
    open &&
    createPortal(
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={() => setOpen(false)}
      >
        <div
          className="modal modal-wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tlb-api-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="tlb-api-modal-title">{editId ? 'تعديل ربط الهيئة' : 'إعداد ربط الهيئة'}</h2>
          <form onSubmit={save}>
            {err && <p className="error-msg">{err}</p>}
            <div className="form-grid">
              <div className="field">
                <label>كود الشركة (CompanyId) *</label>
                <input
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="BUS 001"
                  dir="ltr"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>اسم الربط (ApiNAme)</label>
                <input
                  value={apiNAme}
                  onChange={(e) => setApiNAme(e.target.value)}
                  placeholder="مثال: وكالة عدن"
                />
              </div>
              <div className="field">
                <label>مفتاح API (ApiKey) *</label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required={!editId}
                  placeholder={editId ? 'اتركه فارغاً للإبقاء على الحالي' : ''}
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label>السر (ApiSecret) *</label>
                <input
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  required={!editId}
                  placeholder={editId ? 'اتركه فارغاً للإبقاء على الحالي' : ''}
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>عنوان سيرفر الهيئة (apiBaseUrl)</label>
                <input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  dir="ltr"
                  placeholder={DEFAULT_BASE}
                />
              </div>
              <div className="field">
                <label>الحالة (IsActive)</label>
                <select value={isActive} onChange={(e) => setIsActive(Number(e.target.value))}>
                  <option value={1}>فعال (1)</option>
                  <option value={0}>موقوف (0)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <strong>صلاحيات الإرسال</strong>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
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
                    {p.key === 'passengerSend'
                      ? 'إرسال بيانات المسافر'
                      : p.key === 'autoOnBooking'
                        ? 'إرسال تلقائي عند التذكرة (يفضّل إيقافه)'
                        : p.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'جاري الحفظ…' : 'حفظ'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    )

  return (
  <>
    <div className="panel" style={{ marginBottom: '1rem' }}>
      <div className="page-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h2>الهيئة العامة للنقل — PassengerApi</h2>
        </div>
        <button type="button" className="btn btn-amber" onClick={openCreate}>
          إعداد ربط الهيئة
        </button>
      </div>

      <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
        جدول <code style={{ direction: 'ltr' }}>TlbApiKey</code> — إرسال{' '}
        <code style={{ direction: 'ltr' }}>POST /api/passenger</code>
      </p>

      {err && !open && <p className="error-msg">{err}</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>CompanyId</th>
              <th>ApiNAme</th>
              <th>المفتاح</th>
              <th>العنوان</th>
              <th>الصلاحيات</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const perms = PERM_LABELS.filter((p) => row.permissions[p.key]).map((p) => p.label)
              return (
                <tr key={row.apiId}>
                  <td>
                    <code style={{ direction: 'ltr' }}>{row.companyId}</code>
                  </td>
                  <td>{row.apiNAme || '—'}</td>
                  <td style={{ direction: 'ltr', fontSize: '0.85rem' }}>
                    {row.apiKeyMasked}
                  </td>
                  <td style={{ direction: 'ltr', fontSize: '0.8rem', maxWidth: 180 }}>
                    {row.apiBaseUrl || DEFAULT_BASE}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{perms.join(' · ') || '—'}</td>
                  <td>
                    <span className={`badge ${row.isActive === 1 ? 'badge-ok' : 'badge-danger'}`}>
                      {row.isActive === 1 ? 'فعال' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                        تعديل
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(row)}>
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
                  لم يُضبط ربط الهيئة بعد
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
    {modal}
  </>
  )
}