import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { serverApi } from '../../api/serverApi'
import type { Bus, BusStatus } from '../../types'
import {
  downloadExcel,
  exportTablePdf,
  pick,
  readExcelRows,
} from '../../utils/importExport'

type Catalog = { id: string; name: string }

function defaultExpiryIso() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const expiryDefault = defaultExpiryIso()

const empty = {
  busNumber: '',
  plateNumber: '',
  chassisNumber: '',
  operatingNumber: '',
  busTypeId: '',
  busModelId: '',
  insuranceCompanyId: '',
  insuranceExpiry: expiryDefault,
  registrationExpiry: expiryDefault,
  operatingCardExpiry: expiryDefault,
  initialOdometer: '',
  notes: '',
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
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [busTypes, setBusTypes] = useState<Catalog[]>([])
  const [busModels, setBusModels] = useState<Catalog[]>([])
  const [insurers, setInsurers] = useState<Catalog[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCatalogs = useCallback(async () => {
    const [typesRes, modelsRes, insRes] = await Promise.all([
      serverApi.busTypes.list().catch(() => ({ list: [] })),
      serverApi.busModels.list().catch(() => ({ list: [] })),
      serverApi.insuranceCompanies.list().catch(() => ({ list: [] })),
    ])
    setBusTypes((typesRes.list ?? []).map((r) => ({ id: r.id, name: r.name })))
    setBusModels((modelsRes.list ?? []).map((r) => ({ id: r.id, name: r.name })))
    setInsurers((insRes.list ?? []).map((r) => ({ id: r.id, name: r.name })))
  }, [])

  useEffect(() => {
    if (open) void loadCatalogs()
  }, [open, loadCatalogs])

  const resetForm = () => {
    setForm({ ...empty, insuranceExpiry: defaultExpiryIso(), registrationExpiry: defaultExpiryIso(), operatingCardExpiry: defaultExpiryIso() })
    setEditId(null)
    setSaveErr(null)
  }

  const buildPayload = () => ({
    busNumber: form.busNumber.trim(),
    plateNumber: form.plateNumber.trim(),
    chassisNumber: form.chassisNumber.trim(),
    operatingNumber: form.operatingNumber.trim(),
    busTypeId: form.busTypeId || null,
    busModelId: form.busModelId || null,
    insuranceCompanyId: form.insuranceCompanyId || null,
    insuranceExpiry: form.insuranceExpiry,
    registrationExpiry: form.registrationExpiry,
    operatingCardExpiry: form.operatingCardExpiry,
    initialOdometer: form.initialOdometer.trim(),
    notes: form.notes.trim(),
    type: form.type,
    year: form.year,
    seats: form.seats,
    status: form.status,
  })

  const persist = async (andMore: boolean) => {
    if (!form.plateNumber.trim()) return
    if (!form.busTypeId || !form.busModelId) {
      setSaveErr('اختر النوع والموديل')
      return
    }
    setBusy(true)
    setSaveErr(null)
    try {
      const payload = buildPayload()
      if (editId) {
        await upsertBus({ ...payload, id: editId })
        setOpen(false)
        resetForm()
      } else {
        await upsertBus(payload)
        if (andMore) {
          resetForm()
          setOpen(true)
        } else {
          setOpen(false)
          resetForm()
        }
      }
    } catch (ex) {
      setSaveErr(ex instanceof Error ? ex.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (b: Bus) => {
    setEditId(b.id)
    setForm({
      busNumber: b.busNumber || '',
      plateNumber: b.plateNumber,
      chassisNumber: b.chassisNumber ?? '',
      operatingNumber: b.operatingNumber ?? '',
      busTypeId: b.busTypeId ?? '',
      busModelId: b.busModelId ?? '',
      insuranceCompanyId: b.insuranceCompanyId ?? '',
      insuranceExpiry: b.insuranceExpiry?.slice(0, 10) || defaultExpiryIso(),
      registrationExpiry: b.registrationExpiry?.slice(0, 10) || defaultExpiryIso(),
      operatingCardExpiry: b.operatingCardExpiry?.slice(0, 10) || defaultExpiryIso(),
      initialOdometer: b.initialOdometer ?? '',
      notes: b.notes ?? '',
      type: b.type,
      year: b.year || '',
      seats: b.seats,
      status: b.status,
    })
    setSaveErr(null)
    setOpen(true)
  }

  const exportExcel = () => {
    downloadExcel(
      'الحافلات.xlsx',
      state.buses.map((b) => ({
        'رقم الحافلة': b.busNumber || '',
        'رقم اللوحة': b.plateNumber,
        'رقم الشاصي': b.chassisNumber || '',
        'رقم التشغيل': b.operatingNumber || '',
        النوع: b.type,
        الموديل: b.year || '',
        المقاعد: b.seats,
        الحالة: statusLabel(b.status),
      })),
    )
  }

  const exportPdf = () => {
    exportTablePdf(
      'قائمة الحافلات',
      ['رقم الحافلة', 'رقم اللوحة', 'النوع', 'الموديل', 'المقاعد', 'الحالة'],
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
    downloadExcel('نموذج_استيراد_حافلات.xlsx', [
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
      setImportMsg(`تم استيراد ${ok} حافلة${skipped ? ` · تخطي ${skipped}` : ''}`)
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
          <h1>إدارة الحافلات</h1>
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
              resetForm()
              setOpen(true)
            }}
          >
            إضافة حافلة
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
                <th>الموديل</th>
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
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل حافلة' : 'إضافة حافلة'}</h2>
            {saveErr && <p className="error-msg">{saveErr}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void persist(false)
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label>رقم الحافلة *</label>
                  <input
                    value={form.busNumber}
                    onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم الشاصي *</label>
                  <input
                    required
                    value={form.chassisNumber}
                    onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم اللوحة *</label>
                  <input
                    required
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم التشغيل *</label>
                  <input
                    required
                    value={form.operatingNumber}
                    onChange={(e) => setForm({ ...form, operatingNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>النوع *</label>
                  <select
                    required
                    value={form.busTypeId}
                    onChange={(e) => setForm({ ...form, busTypeId: e.target.value })}
                  >
                    <option value="">اختر</option>
                    {busTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>الموديل *</label>
                  <select
                    required
                    value={form.busModelId}
                    onChange={(e) => setForm({ ...form, busModelId: e.target.value })}
                  >
                    <option value="">اختر</option>
                    {busModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>شركة التأمين *</label>
                  <select
                    value={form.insuranceCompanyId}
                    onChange={(e) => setForm({ ...form, insuranceCompanyId: e.target.value })}
                  >
                    <option value="">اختر</option>
                    {insurers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>تاريخ انتهاء التأمين *</label>
                  <input
                    type="date"
                    required
                    value={form.insuranceExpiry}
                    onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>تاريخ انتهاء الاستمارة *</label>
                  <input
                    type="date"
                    required
                    value={form.registrationExpiry}
                    onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>تاريخ انتهاء كارت التشغيل *</label>
                  <input
                    type="date"
                    required
                    value={form.operatingCardExpiry}
                    onChange={(e) => setForm({ ...form, operatingCardExpiry: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>العداد الابتدائي *</label>
                  <input
                    value={form.initialOdometer}
                    onChange={(e) => setForm({ ...form, initialOdometer: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>عدد المقاعد *</label>
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
              <div className="field" style={{ marginTop: '0.75rem' }}>
                <label>ملاحظات</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
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