import { useRef, useState } from 'react'
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
  const { name, logoUrl, phones, saveBrand, resetBrand } = useBrand()
  const [draftName, setDraftName] = useState(name)
  const [draftLogo, setDraftLogo] = useState<string | null>(logoUrl)
  const [draftPhones, setDraftPhones] = useState(phones)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    saveBrand({ name: draftName, logoUrl: draftLogo, phones: draftPhones })
    setMessage('تم حفظ إعدادات المنصة')
  }

  const restore = () => {
    resetBrand()
    setDraftName(DEFAULT_BRAND_NAME)
    setDraftLogo(null)
    setDraftPhones('')
    setMessage('تمت استعادة الاسم والشعار الافتراضي')
    setError(null)
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
          <p>الشعار واسم الشركة وأرقام التواصل تظهر في كليشة الطباعة</p>
        </div>
      </header>

      <div className="panel settings-panel">
        <form onSubmit={save} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
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
            <button type="submit" className="btn btn-primary">
              حفظ
            </button>
            {draftLogo && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraftLogo(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                إزالة الشعار
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={restore}>
              استعادة الافتراضي
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
