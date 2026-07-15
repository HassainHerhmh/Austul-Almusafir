import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useBrand } from '../context/BrandContext'

function toggleDocumentTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('austul-theme', next)
  return next as 'light' | 'dark'
}

export function LoginPage() {
  const { login, currentUser, isAdmin, loading } = useApp()
  const { name, logoUrl } = useBrand()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ margin: 'auto' }}>
          جاري الاتصال بالسيرفر…
        </div>
      </div>
    )
  }

  if (currentUser) {
    return <Navigate to={isAdmin ? '/admin' : '/office'} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await login(username, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="login-page">
      <button
        type="button"
        className="header-btn login-theme-btn"
        aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
        title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
        onClick={() => setTheme(toggleDocumentTheme())}
      >
        <span className="header-icon" aria-hidden>
          {theme === 'dark' ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
        </span>
      </button>

      <section className="login-visual">
        <div className="login-brand">
          <div className={`brand-icon login-brand-icon${logoUrl ? ' has-logo' : ''}`}>
            {logoUrl ? <img src={logoUrl} alt="" /> : <span aria-hidden>🚌</span>}
          </div>
          <h1>{name}</h1>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>تسجيل الدخول</h2>

          <form onSubmit={(e) => void submit(e)}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label htmlFor="username">اسم المستخدم</label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">كلمة المرور</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="actions" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? 'جاري الدخول…' : 'دخول'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
