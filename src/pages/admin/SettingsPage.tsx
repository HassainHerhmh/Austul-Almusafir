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
  const { name, logoUrl, saveBrand, resetBrand } = useBrand()
  const [draftName, setDraftName] = useState(name)
  const [draftLogo, setDraftLogo] = useState<string | null>(logoUrl)
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
    saveBrand({ name: draftName, logoUrl: draftLogo })
    setMessage('تم حفظ إعدادات المنصة')
  }

  const restore = () => {
    resetBrand()
    setDraftName(DEFAULT_BRAND_NAME)
    setDraftLogo(null)
    setMessage('تمت استعادة الاسم والشعار الافتراضي')
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إعدادات المنصة</h1>
        </div>
      </header>

      <div className="panel settings-panel">
        <form onSubmit={save} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="field">
            <label htmlFor="platform-name">اسم المنصة</label>
            <input
              id="platform-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={DEFAULT_BRAND_NAME}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="platform-logo">شعار المنصة</label>
            <input
              id="platform-logo"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="settings-preview">
            <span className="settings-preview-label">معاينة</span>
            <div className="brand-mark settings-preview-brand">
              <div className={`brand-icon${draftLogo ? ' has-logo' : ''}`}>
                {draftLogo ? <img src={draftLogo} alt="" /> : <span aria-hidden>🚌</span>}
              </div>
              <div>
                <div className="brand-name">{draftName.trim() || DEFAULT_BRAND_NAME}</div>
                <div className="brand-sub">لوحة مدير النظام</div>
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
