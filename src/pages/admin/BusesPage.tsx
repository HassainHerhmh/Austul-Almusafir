import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Bus, BusStatus } from '../../types'
import {
  downloadExcel,
  exportTablePdf,
  pick,
  readExcelRows,
} from '../../utils/importExport'

const empty = {
  busNumber: '',
  plateNumber: '',
  type: '',
  year: '',
  seats: 50,
  status: 'available' as BusStatus,
}

function parseStatus(v: string): BusStatus {
  const s = v.trim()
  if (s === 'صيانة' || s === 'maintenance') return 'maintenance'
  if (s === 'غير نشط' || s === 'inactive') return 'inactive'
  return 'available'
}

const statusLabel = (s: BusStatus) =>
  s === 'available' ? 'متاح' : s === 'maintenance' ? 'صيانة' : 'غير نشط'

export function BusesPage() {
  const { state, upsertBus } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    upsertBus(editId ? { ...form, id: editId } : form)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (b: Bus) => {
    setEditId(b.id)
    setForm({
      busNumber: b.busNumber || '',
      plateNumber: b.plateNumber,
      type: b.type,
      year: b.year || '',
      seats: b.seats,
      status: b.status,
    })
    setOpen(true)
  }

  const exportExcel = () => {
    downloadExcel(
      'الباصات.xlsx',
      state.buses.map((b) => ({
        'رقم الحافلة': b.busNumber || '',
        'رقم اللوحة': b.plateNumber,
        النوع: b.type,
        'موديل الحافلة': b.year || '',
        المقاعد: b.seats,
        الحالة: statusLabel(b.status),
      })),
    )
  }

  const exportPdf = () => {
    exportTablePdf(
      'قائمة الباصات',
      ['رقم الحافلة', 'رقم اللوحة', 'النوع', 'موديل الحافلة', 'المقاعد', 'الحالة'],
      state.buses.map((b) => [
        b.busNumber || '—',
        b.plateNumber,
        b.type,
        b.year || '—',
        b.seats,
        statusLabel(b.status),
      ]),
    )
  }

  const downloadTemplate = () => {
    downloadExcel('نموذج_استيراد_باصات.xlsx', [
      {
        'رقم الحافلة': '101',
        'رقم اللوحة': 'أ ص ح 2234',
        النوع: 'زونج تونج',
        'موديل الحافلة': '2025',
        المقاعد: 50,
        الحالة: 'متاح',
      },
    ])
  }

  const importExcel = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setImportMsg(null)
    try {
      const rows = await readExcelRows(file)
      let ok = 0
      let skipped = 0
      const byPlate = new Map(state.buses.map((b) => [b.plateNumber, b.id]))
      for (const row of rows) {
        const busNumber = pick(row, [
          'رقم الحافلة',
          'م الحافلة',
          'رقمالحافلة',
          'busNumber',
          'fleetNumber',
        ])
        const plateNumber = pick(row, ['رقم اللوحة', 'اللوحة', 'plateNumber', 'plate'])
        const typeCol = pick(row, ['النوع', 'نوع الحافلة', 'type', 'Type'])
        const modelCol = pick(row, ['موديل الحافلة', 'الموديل', 'موديل', 'model', 'Model'])
        const yearCol = pick(row, ['سنة الحافلة', 'السنة', 'سنة', 'year', 'Year'])
        const type =
          typeCol || (modelCol && !/^\d{4}/.test(modelCol) ? modelCol : '')
        const year =
          yearCol || (modelCol && /^\d{4}/.test(modelCol) ? modelCol : '')
        const seatsRaw = pick(row, ['المقاعد', 'seats', 'Seats'])
        const seats = Math.max(1, Number(seatsRaw) || 50)
        if (!plateNumber || !type) {
          skipped++
          continue
        }
        const status = parseStatus(pick(row, ['الحالة', 'status', 'Status']) || 'متاح')
        const existingId = byPlate.get(plateNumber)
        const saved = await upsertBus({
          ...(existingId ? { id: existingId } : {}),
          busNumber,
          plateNumber,
          type,
          year,
          seats,
          status,
        })
        byPlate.set(plateNumber, saved.id)
        ok++
      }
      setImportMsg(`تم استيراد ${ok} باص${skipped ? ` · تخطي ${skipped}` : ''}`)
    } catch {
      setImportMsg('فشل قراءة ملف Excel')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الباصات</h1>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={downloadTemplate}>
            نموذج Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            استيراد Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => void importExcel(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn btn-ghost" onClick={exportExcel} disabled={!state.buses.length}>
            تصدير Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportPdf} disabled={!state.buses.length}>
            تصدير PDF
          </button>
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => {
              setEditId(null)
              setForm(empty)
              setOpen(true)
            }}
          >
            إضافة باص
          </button>
        </div>
      </header>

      {importMsg && <p className="success-msg" style={{ marginBottom: '0.75rem' }}>{importMsg}{busy ? '…' : ''}</p>}

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>رقم الحافلة</th>
                <th>رقم اللوحة</th>
                <th>النوع</th>
                <th>موديل الحافلة</th>
                <th>المقاعد</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.buses.map((b) => (
                <tr key={b.id}>
                  <td>{b.busNumber || '—'}</td>
                  <td>{b.plateNumber}</td>
                  <td>{b.type}</td>
                  <td>{b.year || '—'}</td>
                  <td>{b.seats}</td>
                  <td>
                    <span
                      className={`badge ${
                        b.status === 'available'
                          ? 'badge-ok'
                          : b.status === 'maintenance'
                            ? 'badge-warn'
                            : 'badge-danger'
                      }`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(b)}>
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
            <h2>{editId ? 'تعديل باص' : 'باص جديد'}</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>رقم الحافلة</label>
                  <input
                    value={form.busNumber}
                    onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                    placeholder="مثال: 101"
                  />
                </div>
                <div className="field">
                  <label>رقم اللوحة</label>
                  <input
                    required
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>النوع</label>
                  <input
                    required
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    placeholder="مثال: زونج تونج"
                  />
                </div>
                <div className="field">
                  <label>موديل الحافلة</label>
                  <input
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="مثال: 2025"
                  />
                </div>
                <div className="field">
                  <label>عدد المقاعد</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BusStatus })}
                  >
                    <option value="available">متاح</option>
                    <option value="maintenance">صيانة</option>
                    <option value="inactive">غير نشط</option>
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
