import { Bell, Menu, Moon, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatMoney } from './utils'

const THEME_KEY = 'austul-theme'
const SEEN_KEY = 'austul-notifs-seen'

function loadTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return 'light'
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
}

function loadSeenAt(): string {
  return localStorage.getItem(SEEN_KEY) ?? new Date(0).toISOString()
}

export function TopHeader({
  onOpenNav,
  menuOpen,
}: {
  onOpenNav?: () => void
  menuOpen?: boolean
} = {}) {
  const {
    currentUser,
    currentOffice,
    isAdmin,
    logout,
    state,
    getTripLabel,
    getOffice,
    getOfficeAgencyBalance,
  } = useApp()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme())
  const [openNotifs, setOpenNotifs] = useState(false)
  const [seenAt, setSeenAt] = useState(() => loadSeenAt())
  const panelRef = useRef<HTMLDivElement>(null)

  const agencyBalance = useMemo(
    () => (!isAdmin && currentOffice ? getOfficeAgencyBalance(currentOffice.id) : 0),
    [isAdmin, currentOffice, getOfficeAgencyBalance, state.bookings],
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpenNotifs(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('notif-open', openNotifs)
    return () => document.body.classList.remove('notif-open')
  }, [openNotifs])

  const relevantBookings = useMemo(() => {
    let list = [...state.bookings].filter((b) => b.status === 'confirmed')
    if (!isAdmin && currentOffice) {
      list = list.filter((b) => b.officeId === currentOffice.id)
    }
    return list.sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
  }, [state.bookings, isAdmin, currentOffice])

  const newBookings = useMemo(
    () => relevantBookings.filter((b) => b.bookedAt > seenAt).slice(0, 12),
    [relevantBookings, seenAt],
  )

  const unreadCount = newBookings.length

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  const markAllSeen = () => {
    const now = new Date().toISOString()
    localStorage.setItem(SEEN_KEY, now)
    setSeenAt(now)
  }

  const openPanel = () => {
    setOpenNotifs((v) => !v)
  }

  const goBookings = () => {
    markAllSeen()
    setOpenNotifs(false)
    navigate(isAdmin ? '/admin/bookings' : '/office/bookings')
  }

  return (
    <header className="top-header">
      <div className="top-header-start">
        {onOpenNav && (
          <button
            type="button"
            className="header-btn mobile-nav-btn mobile-only"
            aria-label="فتح القائمة"
            aria-expanded={!!menuOpen}
            title="القائمة"
            onClick={onOpenNav}
          >
            <span className="header-icon" aria-hidden>
              <Menu strokeWidth={1.75} />
            </span>
          </button>
        )}
        <div className="top-header-title">
          <strong>{isAdmin ? 'لوحة مدير النظام' : currentOffice?.name}</strong>
          <span>{currentUser?.name}</span>
        </div>
        {!isAdmin && currentOffice && (
          <div className="agency-balance-chip" title="ما يترتب على المكتب لدى الوكالة من حجوزات">
            <span className="agency-balance-label">الرصيد عليكم لدى الوكالة</span>
            <strong className="agency-balance-value">{formatMoney(agencyBalance)}</strong>
          </div>
        )}
      </div>

      <div className="top-header-actions">
        <div className="notif-wrap" ref={panelRef}>
          <button
            type="button"
            className="header-btn"
            aria-label="الإشعارات"
            title="الإشعارات"
            onClick={openPanel}
          >
            <span className="header-icon" aria-hidden>
              <Bell strokeWidth={1.75} />
            </span>
            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 9 ? '+9' : `+${unreadCount}`}
              </span>
            )}
          </button>

          {openNotifs && (
            <div className="notif-panel">
              <div className="notif-panel-head">
                <strong>حجوزات جديدة</strong>
                {unreadCount > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={markAllSeen}>
                    تعليم كمقروء
                  </button>
                )}
              </div>
              {newBookings.length === 0 ? (
                <div className="notif-empty">لا توجد حجوزات جديدة</div>
              ) : (
                <ul className="notif-list">
                  {newBookings.map((b) => {
                    const trip = state.trips.find((t) => t.id === b.tripId)
                    return (
                      <li key={b.id}>
                        <button type="button" className="notif-item" onClick={goBookings}>
                          <strong>{b.passengerName}</strong>
                          <span>
                            {trip ? getTripLabel(trip) : 'رحلة'} · مقعد {b.seatNumber}
                          </span>
                          {isAdmin && (
                            <span className="notif-meta">{getOffice(b.officeId)?.name}</span>
                          )}
                          <span className="notif-meta">
                            {b.bookedAt.slice(0, 16).replace('T', ' ')}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <button type="button" className="notif-footer-link" onClick={goBookings}>
                عرض كل الحجوزات
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="header-btn"
          aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          onClick={toggleTheme}
        >
          <span className="header-icon" aria-hidden>
            {theme === 'dark' ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
          </span>
        </button>

        <button
          type="button"
          className="header-btn header-btn-logout"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          خروج
        </button>
      </div>
    </header>
  )
}

/** استدعاء مبكر لتطبيق الثيم قبل الرسم */
export function initTheme() {
  applyTheme(loadTheme())
}
