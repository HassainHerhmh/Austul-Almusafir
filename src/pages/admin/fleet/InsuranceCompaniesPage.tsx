import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '../../../api/serverApi'

type Row = { id: string; name: string; phone: string }

export function InsuranceCompaniesPage() {
  const [list, setList] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await serverApi.insuranceCompanies.list()
    setList(
      (res.list ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? '',
      })),
    )
  }, [])

  useEffect(() => {
    void load().catch(() => setList([]))
  }, [load])

  const reset = () => {
    setEditId(null)
    setName('')
    setPhone('')
    setErr(null)
  }

  const persist = async (andMore: boolean) => {
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const payload = { name: name.trim(), phone: phone.trim() }
      if (editId) {
        await serverApi.insuranceCompanies.update(editId, payload)
        setOpen(false)
        reset()
      } else {
        await serverApi.insuranceCompanies.create(payload)
        if (andMore) {
          reset()
          setOpen(true)
        } else {
          setOpen(false)
          reset()
        }
      }
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>شركات التأمين</h1>
        </div>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => {
            reset()
            setOpen(true)
          }}
        >
          إضافة شركة
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>الهاتف</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.phone || '—'}</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditId(row.id)
                          setName(row.name)
                          setPhone(row.phone)
                          setOpen(true)
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`حذف «${row.name}»؟`))
                            void serverApi.insuranceCompanies.remove(row.id).then(load)
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    لا توجد بيانات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل شركة تأمين' : 'شركة تأمين جديدة'}</h2>
            {err && <p className="error-msg">{err}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void persist(false)
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label>اسم الشركة</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                  <label>الهاتف</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {editId ? 'حفظ' : 'إضافة'}
                </button>
                {!editId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void persist(true)}
                  >
                    إضافة وبدء إضافة المزيد
                  </button>
                )}
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