import { useEffect, useRef, useState } from 'react'
import { DEFAULT_BRAND_NAME, useBrand } from '../../context/BrandContext'

const MAX_BYTES = 900_000

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'))
    reader.readAsDataURL(file)
  })
}

export function SettingsPage() {
  const { name, logoUrl, phones, saveBrand, resetBrand, brandReady } = useBrand()
  const [draftName, setDraftName] = useState(name)
  const [draftLogo, setDraftLogo] = useState<string | null>(logoUrl)
  const [draftPhones, setDraftPhones] = useState(phones)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!brandReady) return
    setDraftName(name)
    setDraftLogo(logoUrl)
    setDraftPhones(phones)
  }, [brandReady, name, logoUrl, phones])

  const onPickLogo = async (file: File | null) => {
    setError(null)
    setMessage(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('الرجاء اختيار ملف صورة')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('حجم الشعار كبير جداً — اختر صورة أصغر من 900 كيلوبايت')
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      setDraftLogo(dataUrl)
    } catch {
      setError('تعذر تحميل الشعار')
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    const err = await saveBrand({
      name: draftName,
      logoUrl: draftLogo,
      phones: draftPhones,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setMessage('تم حفظ إعدادات الهوية على السيرفر — تظهر على كل الأجهزة')
  }

  const restore = async () => {
    setBusy(true)
    setError(null)
    const err = await resetBrand()
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setDraftName(DEFAULT_BRAND_NAME)
    setDraftLogo(null)
    setDraftPhones('')
    setMessage('تمت استعادة الاسم والشعار الافتراضي على السيرفر')
    if (fileRef.current) fileRef.current.value = ''
  }

  const phoneLines = draftPhones
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إعدادات المنصة</h1>
          <p>الشعار واسم الشركة وأرقام التواصل تُحفظ على السيرفر وتظهر في الدخول والطباعة لكل الأجهزة</p>
        </div>
      </header>

      <div className="panel settings-panel">
        <form onSubmit={(e) => void save(e)} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="field">
            <label htmlFor="platform-name">اسم الشركة / المنصة</label>
            <input
              id="platform-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={DEFAULT_BRAND_NAME}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="platform-logo">شعار الشركة</label>
            <input
              id="platform-logo"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="field">
            <label htmlFor="platform-phones">أرقام التواصل (لكليشة الطباعة)</label>
            <textarea
              id="platform-phones"
              rows={3}
              value={draftPhones}
              onChange={(e) => setDraftPhones(e.target.value)}
              placeholder={'مثال:\n777123456\n733987654'}
              style={{ resize: 'vertical', minHeight: '4.5rem' }}
            />
            <span className="field-hint">سطر لكل رقم، أو مفصولة بفاصلة</span>
          </div>

          <div className="settings-preview">
            <span className="settings-preview-label">معاينة الكليشة</span>
            <div className="print-cliche-preview">
              {draftLogo ? (
                <img src={draftLogo} alt="" className="print-cliche-logo" />
              ) : (
                <div className="print-cliche-logo-fallback" aria-hidden>
                  🚌
                </div>
              )}
              <div className="print-cliche-text">
                <div className="print-cliche-name">
                  {draftName.trim() || DEFAULT_BRAND_NAME}
                </div>
                {phoneLines.length > 0 ? (
                  <div className="print-cliche-phones">{phoneLines.join(' · ')}</div>
                ) : (
                  <div className="print-cliche-phones muted">أضف أرقام التواصل أعلاه</div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          {message && <p className="success-msg">{message}</p>}

          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !brandReady}>
              {busy ? 'جاري الحفظ…' : 'حفظ على السيرفر'}
            </button>
            {draftLogo && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  setDraftLogo(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                إزالة الشعار
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void restore()}
            >
              استعادة الافتراضي
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
