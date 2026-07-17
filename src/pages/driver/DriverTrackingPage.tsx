import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { serverApi } from '../../api/serverApi'
import { ApiError } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { useBrand } from '../../context/BrandContext'

type TripRow = Awaited<ReturnType<typeof serverApi.tracking.myTrips>>['list'][number]

const PING_MIN_MS = 10000

export function DriverTrackingPage() {
  const { currentUser, logout, loading } = useApp()
  const { name: brandName, logoUrl } = useBrand()
  const [trips, setTrips] = useState<TripRow[]>([])
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [lastPing, setLastPing] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const activeTripRef = useRef<string | null>(null)
  const lastPingAtRef = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    activeTripRef.current = activeTripId
  }, [activeTripId])

  const refreshTrips = useCallback(async () => {
    const res = await serverApi.tracking.myTrips()
    setTrips(res.list ?? [])
  }, [])

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'driver') return
    void refreshTrips().catch((e) => {
      setError(e instanceof Error ? e.message : 'فشل تحميل الرحلات')
    })
  }, [currentUser, refreshTrips])

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release()
    } catch {
      /* ignore */
    }
    wakeLockRef.current = null
  }

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      }
    } catch {
      /* غير مدعوم على بعض الأجهزة */
    }
  }

  const stopWatch = useCallback(async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    await releaseWakeLock()
  }, [])

  const sendPing = useCallback(async (tripId: string, lat: number, lng: number, accuracy?: number | null) => {
    const now = Date.now()
    if (now - lastPingAtRef.current < PING_MIN_MS) return
    lastPingAtRef.current = now
    await serverApi.tracking.ping({
      tripId,
      lat,
      lng,
      accuracy: accuracy ?? null,
    })
    setLastPing(new Date().toLocaleTimeString('ar-YE'))
    setCoords({ lat, lng })
  }, [])

  const startTrip = async (trip: TripRow) => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      if (activeTripId && activeTripId !== trip.id) {
        try {
          await serverApi.tracking.stop(activeTripId)
        } catch {
          /* ignore */
        }
        await stopWatch()
      }

      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (err) => reject(new Error(err.message || 'يجب السماح بالموقع')),
          { enableHighAccuracy: true, timeout: 20000 },
        )
      })

      setActiveTripId(trip.id)
      await requestWakeLock()

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const tripId = activeTripRef.current
          if (!tripId) return
          void sendPing(
            tripId,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
          ).catch((e) => {
            if (e instanceof ApiError && e.status === 401) {
              setError('انتهت الجلسة — أعد تسجيل الدخول')
              void stopWatch()
              setActiveTripId(null)
            }
          })
        },
        (err) => {
          setError(err.message || 'تعذر قراءة الموقع')
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        },
      )

      setStatus(`التتبع يعمل: ${trip.label || trip.plateNumber} — أبقِ هذه الصفحة مفتوحة`)
      await refreshTrips().catch(() => undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء التتبع')
      setActiveTripId(null)
      await stopWatch()
    } finally {
      setBusy(false)
    }
  }

  const stopTrip = async () => {
    if (!activeTripId) return
    setBusy(true)
    setError(null)
    try {
      try {
        await serverApi.tracking.stop(activeTripId)
      } catch {
        /* ignore */
      }
      await stopWatch()
      setActiveTripId(null)
      setStatus('تم إيقاف التتبع')
      await refreshTrips().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && activeTripRef.current) {
        void requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void stopWatch()
    }
  }, [stopWatch])

  if (loading) {
    return (
      <div className="driver-track-page">
        <div className="driver-track-card">جاري التحميل…</div>
      </div>
    )
  }

  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'driver') {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/office'} replace />
  }

  return (
    <div className="driver-track-page">
      <header className="driver-track-header">
        <div className="driver-track-brand">
          {logoUrl ? <img src={logoUrl} alt="" /> : <span aria-hidden>🚌</span>}
          <div>
            <strong>{brandName}</strong>
            <div className="driver-track-sub">تتبع الرحلة — {currentUser.name}</div>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()}>
          خروج
        </button>
      </header>

      <div className="driver-track-card">
        <p className="driver-track-note">
          من المتصفح: التتبع يعمل طالما الصفحة مفتوحة. إذا أردت الإرسال بعد قفل الشاشة أو مغادرة المتصفح،
          استخدم تطبيق التتبع (APK) — يظهر إشعار «تتبع الرحلة شغال» ويمكن إيقافه من شريط الإشعارات.
        </p>

        {status && <p className="success-msg">{status}</p>}
        {error && <p className="error-msg">{error}</p>}
        {lastPing && (
          <p className="driver-track-meta">
            آخر إرسال: {lastPing}
            {coords ? ` · ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : ''}
          </p>
        )}

        {activeTripId && (
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            disabled={busy}
            onClick={() => void stopTrip()}
          >
            إيقاف التتبع
          </button>
        )}

        <div className="actions" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setError(null)
              void refreshTrips().catch((e) =>
                setError(e instanceof Error ? e.message : 'فشل التحديث'),
              )
            }}
          >
            تحديث الرحلات
          </button>
        </div>

        <div className="driver-trip-list">
          {trips.map((trip) => {
            const active = activeTripId === trip.id
            return (
              <div key={trip.id} className={`driver-trip${active ? ' is-active' : ''}`}>
                <strong>{trip.label || 'رحلة'}</strong>
                <div className="driver-track-meta">
                  {[trip.busNumber, trip.plateNumber].filter(Boolean).join(' — ')}
                </div>
                <div className="driver-track-meta">
                  {trip.date} · {trip.departureTime} · {trip.status}
                </div>
                <button
                  type="button"
                  className={`btn ${active ? 'btn-ghost' : 'btn-primary'}`}
                  style={{ width: '100%', marginTop: '0.65rem' }}
                  disabled={busy || active}
                  onClick={() => void startTrip(trip)}
                >
                  {active ? 'التتبع يعمل…' : 'بدء التتبع'}
                </button>
              </div>
            )
          })}
          {trips.length === 0 && (
            <p className="empty">لا توجد رحلات متاحة — تأكد أن السائق مربوط برحلة مفتوحة</p>
          )}
        </div>
      </div>
    </div>
  )
}
