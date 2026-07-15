import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

function toggleDocumentTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('austul-theme', next)
  return next as 'light' | 'dark'
}

export function LoginPage() {
  const { login, currentUser, isAdmin, state } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  if (currentUser) {
    return <Navigate to={isAdmin ? '/admin' : '/office'} replace />
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = login(username, password)
    if (err) {
      setError(err)
      return
    }
    const user = state.users.find(
      (u) => u.username === username.trim() && u.password === password,
    )
    navigate(user?.role === 'admin' ? '/admin' : '/office')
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
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
      </button>

      <section className="login-visual">
        <div className="login-brand">
          <h1>أسطول المسافر</h1>
          <p>منصة واحدة لإدارة مكاتب السفريات والرحلات والمقاعد — بشكل مركزي وفوري.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>تسجيل الدخول</h2>
          <p>ادخل بحساب المدير أو حساب المكتب</p>

          <form onSubmit={submit}>
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
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                دخول
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
