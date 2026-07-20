import { useEffect, useMemo, useState } from 'react'
import { serverApi } from '../../api/serverApi'
import { useBrand } from '../../context/BrandContext'
import {
  DEFAULT_PRINT_SETTINGS,
  normalizePrintSettings,
  type PrintSettings,
} from '../../print/printSettings'
import { voucherPreviewHtml, type VoucherPrintKind } from '../../print/voucherDocument'

const PREVIEW_KINDS: { id: VoucherPrintKind; label: string }[] = [
  { id: 'receipt', label: 'سند قبض' },
  { id: 'payment', label: 'سند صرف' },
  { id: 'credit_note', label: 'إشعار دائن' },
]

const COLOR_FIELDS: { key: keyof PrintSettings; label: string }[] = [
  { key: 'primaryColor', label: 'اللون الأساسي (الاسم)' },
  { key: 'accentColor', label: 'الذهبي / اللوحة الجانبية' },
  { key: 'titleBgColor', label: 'خلفية عنوان السند' },
  { key: 'titleTextColor', label: 'لون عنوان السند' },
  { key: 'frameColor', label: 'لون الإطار' },
]

export function PrintSettingsPage() {
  const { name, logoUrl, phones, brandReady } = useBrand()
  const [draft, setDraft] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [previewKind, setPreviewKind] = useState<VoucherPrintKind>('receipt')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await serverApi.settings.print.get()
        if (!cancelled) {
          setDraft(normalizePrintSettings(res.data))
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setDraft(DEFAULT_PRINT_SETTINGS)
          setReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const previewHtml = useMemo(() => {
    if (!brandReady || !ready) return ''
    return voucherPreviewHtml({
      brandName: name,
      logoUrl,
      phones,
      settings: draft,
      voucher: {
        kind: previewKind,
        number: '121',
        date: new Date().toLocaleDateString('en-GB'),
        partyLabel: previewKind === 'payment' ? 'المستفيد' : 'عميلنا',
        partyName: 'وكالة تجريبية',
        accountLabel: 'الحساب',
        accountValue: '123456',
        amount: 15464,
        currency: 'ريال سعودي',
        description: 'بيان تجريبي فقط — معاينة إعدادات الطباعة',
        note: '',
      },
    })
  }, [brandReady, ready, name, logoUrl, phones, draft, previewKind])

  const setField = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await serverApi.settings.print.save(draft)
      setDraft(normalizePrintSettings(res.data))
      setMessage('تم حفظ إعدادات الطباعة — تُطبَّق على سندات القبض/الصرف والكليشة')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  const restore = () => {
    setDraft(DEFAULT_PRINT_SETTINGS)
    setMessage('تمت استعادة الألوان الذهبية الافتراضية — احفظ لتثبيتها على السيرفر')
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إعدادات الطباعة</h1>
          <p>
            كليشة السندات بنسق الإشعار — عدّل الألوان والعنوان والشعار الذهبي يظهر من إعدادات
            المنصة
          </p>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.9fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
        className="print-settings-layout"
      >
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="panel-head"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
          >
            <h2 style={{ margin: 0, flex: 1 }}>معاينة</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PREVIEW_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`btn btn-sm ${previewKind === k.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPreviewKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: '#e8ecf1', padding: '0.75rem' }}>
            {previewHtml ? (
              <iframe
                title="معاينة السند"
                srcDoc={previewHtml}
                style={{
                  width: '100%',
                  height: 'min(78vh, 920px)',
                  border: 'none',
                  borderRadius: 8,
                  background: '#fff',
                }}
              />
            ) : (
              <div className="empty" style={{ padding: '3rem' }}>
                جاري تحميل المعاينة…
              </div>
            )}
          </div>
        </div>

        <form className="panel" onSubmit={(e) => void save(e)}>
          <div className="panel-head">
            <h2>نسق الألوان والنصوص</h2>
          </div>

          {error && <p className="error-msg">{error}</p>}
          {message && (
            <p style={{ color: 'var(--ok, #0f766e)', fontWeight: 600, marginTop: 0 }}>{message}</p>
          )}

          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            {COLOR_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(String(draft[f.key]))
                        ? String(draft[f.key])
                        : '#c9a227'
                    }
                    onChange={(e) => setField(f.key, e.target.value)}
                    style={{ width: 44, height: 36, padding: 2, cursor: 'pointer' }}
                  />
                  <input
                    value={String(draft[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            ))}

            <div className="field">
              <label>الاسم الإنجليزي</label>
              <input
                value={draft.nameEn}
                onChange={(e) => setField('nameEn', e.target.value)}
              />
            </div>
            <div className="field">
              <label>الشعار النصي / السطر الذهبي</label>
              <input
                value={draft.slogan}
                onChange={(e) => setField('slogan', e.target.value)}
                placeholder="الراحة.. وجهتنا"
              />
            </div>
            <div className="field">
              <label>العنوان</label>
              <input
                value={draft.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="المدينة — الحي — الشارع"
              />
            </div>
            <div className="field">
              <label>أرقام الإدارة</label>
              <input
                value={draft.managementPhones}
                onChange={(e) => setField('managementPhones', e.target.value)}
                placeholder="إن فُرغت تُستخدم أرقام إعدادات المنصة"
              />
            </div>
            <div className="field">
              <label>أرقام خدمة العملاء (كل سطر = كبسولة في اللوحة الذهبية)</label>
              <textarea
                rows={3}
                value={draft.servicePhones}
                onChange={(e) => setField('servicePhones', e.target.value)}
                placeholder={'خدمة عملاء توصيل : 77...\nخدمة عملاء المتجر : 77...'}
              />
            </div>
            <div className="field">
              <label>ملاحظة تذييل السند</label>
              <input
                value={draft.footerNote}
                onChange={(e) => setField('footerNote', e.target.value)}
              />
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: '0.75rem' }}>
            الشعار الذهبي يُؤخذ من <strong>إعدادات المنصة</strong> — ارفع شعار الشركة الذهبي هناك.
          </p>

          <div className="actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={restore}>
              استعادة الذهبي الافتراضي
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .print-settings-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
