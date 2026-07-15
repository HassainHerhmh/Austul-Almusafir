import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export function DestinationsPage() {
  const { state, upsertDestination } = useApp()
  const [name, setName] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setTicketPrice('')
    setEditId(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const price = Math.max(0, Number(ticketPrice) || 0)
    await upsertDestination(
      editId
        ? { id: editId, name: name.trim(), ticketPrice: price }
        : { name: name.trim(), ticketPrice: price },
    )
    resetForm()
  }

  const priceValue = (id: string, current: number) =>
    priceDrafts[id] !== undefined ? priceDrafts[id] : current > 0 ? String(current) : ''

  const savePrice = async (id: string, destName: string, current: number) => {
    const raw = priceDrafts[id]
    if (raw === undefined) return
    const price = Math.max(0, Number(raw) || 0)
    if (price === current) {
      setPriceDrafts((d) => {
        const next = { ...d }
        delete next[id]
        return next
      })
      return
    }
    setSavingId(id)
    try {
      await upsertDestination({ id, name: destName, ticketPrice: price })
      setPriceDrafts((d) => {
        const next = { ...d }
        delete next[id]
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الوجهات</h1>
          <p>حدّد سعر التذكرة لكل منطقة مباشرة من الجدول — يُستخدم عند تسعير «حسب منطقة الصعود»</p>
        </div>
      </header>

      <div className="panel">
        <form onSubmit={(e) => void save(e)} className="actions" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>{editId ? 'تعديل الوجهة' : 'وجهة جديدة'}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label>سعر التذكرة</label>
            <input
              type="number"
              min={0}
              step={1}
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
            {editId ? 'تحديث' : 'إضافة'}
          </button>
          {editId && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-end' }}
              onClick={resetForm}
            >
              إلغاء
            </button>
          )}
        </form>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الوجهة</th>
                <th style={{ width: 160 }}>سعر التذكرة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.destinations.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      disabled={savingId === d.id}
                      value={priceValue(d.id, d.ticketPrice)}
                      placeholder="0"
                      aria-label={`سعر تذكرة ${d.name}`}
                      onChange={(e) =>
                        setPriceDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      onBlur={() => void savePrice(d.id, d.name, d.ticketPrice)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      style={{
                        width: '100%',
                        maxWidth: 140,
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        padding: '0.4rem 0.55rem',
                        fontSize: '0.95rem',
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditId(d.id)
                        setName(d.name)
                        setTicketPrice(d.ticketPrice ? String(d.ticketPrice) : '')
                      }}
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
    </div>
  )
}
