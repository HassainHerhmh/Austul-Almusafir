import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '../../../api/serverApi'
import { formatMoney } from '../../../components/utils'

type Row = { id: string; name: string; partCode: string; unitPrice: number }

export function SparePartsPage() {
  const [list, setList] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await serverApi.maintenance.spareParts.list()
    setList(
      (res.list ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        partCode: r.partCode ?? '',
        unitPrice: Number(r.unitPrice) || 0,
      })),
    )
  }, [])

  useEffect(() => {
    void load().catch(() => setList([]))
  }, [load])

  const reset = () => {
    setEditId(null)
    setName('')
    setPartCode('')
    setUnitPrice(0)
    setErr(null)
  }

  const startAdd = () => {
    reset()
    setOpen(true)
  }

  const startEdit = (row: Row) => {
    setEditId(row.id)
    setName(row.name)
    setPartCode(row.partCode)
    setUnitPrice(row.unitPrice)
    setErr(null)
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    const payload = {
      name: name.trim(),
      partCode: partCode.trim(),
      unitPrice,
    }
    try {
      if (editId) {
        await serverApi.maintenance.spareParts.update(editId, payload)
      } else {
        await serverApi.maintenance.spareParts.create(payload)
      }
      setOpen(false)
      reset()
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: Row) => {
    if (!confirm(`حذف قطعة «${row.name}»؟`)) return
    try {
      await serverApi.maintenance.spareParts.remove(row.id)
      await load()
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'فشل الحذف')
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>قطع الغيار</h2>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-amber" onClick={startAdd}>
            إضافة قطع غيار
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>القطعة</th>
                <th>الرمز</th>
                <th>سعر الوحدة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.partCode || '—'}</td>
                  <td>{formatMoney(row.unitPrice)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(row)}>
                        تعديل
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(row)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    لا توجد قطع — اضغط «إضافة قطع غيار»
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
            <h2>{editId ? 'تعديل قطعة' : 'قطعة غيار جديدة'}</h2>
            {err && <p className="error-msg">{err}</p>}
            <form onSubmit={(e) => void save(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>اسم القطعة</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="مثال: فلتر زيت"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>رمز/كود (اختياري)</label>
                  <input value={partCode} onChange={(e) => setPartCode(e.target.value)} />
                </div>
                <div className="field">
                  <label>سعر الوحدة</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitPrice || ''}
                    onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'جاري الحفظ…' : 'حفظ'}
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