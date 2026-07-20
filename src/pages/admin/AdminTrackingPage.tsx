import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'
import { formatTimeAr } from '../../components/utils'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type LiveItem = Awaited<ReturnType<typeof serverApi.tracking.live>>['list'][number]
type ShareItem = Awaited<ReturnType<typeof serverApi.tracking.shares.list>>['list'][number]
type ShareableTrip = Awaited<ReturnType<typeof serverApi.tracking.shareableTrips>>['list'][number]
type OfficeAccessItem = Awaited<ReturnType<typeof serverApi.tracking.officeAccess.list>>['list'][number]
type TrackStatus = 'live' | 'interrupted' | 'stopped'

const STALE_MS = 2 * 60 * 1000

function isStale(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() > STALE_MS
}

function trackStatus(item: LiveItem): TrackStatus {
  if (!item.active) return 'stopped'
  if (isStale(item.updatedAt)) return 'interrupted'
  return 'live'
}

function statusLabel(status: TrackStatus) {
  if (status === 'live') return 'مباشر'
  if (status === 'interrupted') return 'انقطع الإرسال'
  return 'متوقف'
}

function statusColor(status: TrackStatus) {
  if (status === 'live') return '#0f766e'
  if (status === 'interrupted') return '#b45309'
  return '#64748b'
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function busMarkerIcon(busNumber: string, status: TrackStatus) {
  const bg = statusColor(status)
  const label = escapeHtml((busNumber || '؟').trim() || '؟')
  return new L.DivIcon({
    className: 'bus-map-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.1;pointer-events:none;">
      <div style="background:#fff;color:#0c1a24;font-weight:800;font-size:12px;padding:2px 7px;border-radius:8px;border:2px solid ${bg};box-shadow:0 2px 6px rgba(0,0,0,.28);white-space:nowrap;margin-bottom:3px;">${label}</div>
      <div style="background:${bg};color:#fff;border-radius:999px;width:30px;height:30px;display:grid;place-items:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">🚌</div>
    </div>`,
    iconSize: [72, 54],
    iconAnchor: [36, 50],
    popupAnchor: [0, -46],
  })
}

function FitBounds({
  points,
  tripKey,
}: {
  points: { lat: number; lng: number }[]
  tripKey: string
}) {
  const map = useMap()
  const lastKey = useRef('')
  useEffect(() => {
    if (!points.length) return
    if (lastKey.current === tripKey) return
    lastKey.current = tripKey
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
  }, [map, points, tripKey])
  return null
}

function shareUrl(urlPath: string) {
  return `${window.location.origin}${urlPath}`
}

export function AdminTrackingPage() {
  const { state } = useApp()
  const [list, setList] = useState<LiveItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [shareOpen, setShareOpen] = useState(false)
  const [shareTrips, setShareTrips] = useState<ShareableTrip[]>([])
  const [shares, setShares] = useState<ShareItem[]>([])
  const [selectedTripId, setSelectedTripId] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [accessOpen, setAccessOpen] = useState(false)
  const [accessTrips, setAccessTrips] = useState<ShareableTrip[]>([])
  const [accessList, setAccessList] = useState<OfficeAccessItem[]>([])
  const [accessTripId, setAccessTripId] = useState('')
  const [accessOfficeId, setAccessOfficeId] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  const offices = useMemo(
    () => [...state.offices].filter((o) => o.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [state.offices],
  )

  const refresh = useCallback(async () => {
    try {
      const res = await serverApi.tracking.live()
      setList(res.list ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تحميل المواقع')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const loadShareData = useCallback(async () => {
    setShareError(null)
    try {
      const [tripsRes, sharesRes] = await Promise.all([
        serverApi.tracking.shareableTrips(),
        serverApi.tracking.shares.list(),
      ])
      setShareTrips(tripsRes.list ?? [])
      setShares(sharesRes.list ?? [])
      setSelectedTripId((prev) => prev || tripsRes.list?.[0]?.id || '')
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'فشل تحميل روابط التتبع')
    }
  }, [])

  const openShareModal = () => {
    setShareOpen(true)
    setLastCreatedUrl(null)
    void loadShareData()
  }

  const createShare = async () => {
    if (!selectedTripId) {
      setShareError('اختر رحلة أولاً')
      return
    }
    setShareBusy(true)
    setShareError(null)
    try {
      const res = await serverApi.tracking.shares.create({ tripId: selectedTripId })
      const url = shareUrl(res.share.urlPath)
      setLastCreatedUrl(url)
      setShares((prev) => [res.share, ...prev.filter((s) => s.id !== res.share.id)])
      try {
        await navigator.clipboard.writeText(url)
        setCopiedId(res.share.id)
      } catch {
        /* ignore */
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'فشل إنشاء الرابط')
    } finally {
      setShareBusy(false)
    }
  }

  const copyShare = async (item: ShareItem) => {
    const url = shareUrl(item.urlPath)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(item.id)
      setLastCreatedUrl(url)
    } catch {
      setShareError('تعذر النسخ — انسخ الرابط يدوياً')
      setLastCreatedUrl(url)
    }
  }

  const stopShare = async (id: string) => {
    setShareBusy(true)
    setShareError(null)
    try {
      await serverApi.tracking.shares.stop(id)
      setShares((prev) => prev.map((s) => (s.id === id ? { ...s, active: false } : s)))
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'فشل إيقاف الرابط')
    } finally {
      setShareBusy(false)
    }
  }

  const resumeShare = async (id: string) => {
    setShareBusy(true)
    setShareError(null)
    try {
      await serverApi.tracking.shares.resume(id)
      setShares((prev) => prev.map((s) => (s.id === id ? { ...s, active: true } : s)))
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'فشل استئناف الرابط')
    } finally {
      setShareBusy(false)
    }
  }

  const deleteShare = async (id: string) => {
    if (!window.confirm('حذف رابط التتبع نهائياً؟ لن يعمل الرابط بعد الحذف.')) return
    setShareBusy(true)
    setShareError(null)
    try {
      await serverApi.tracking.shares.remove(id)
      setShares((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'فشل حذف الرابط')
    } finally {
      setShareBusy(false)
    }
  }

  const loadAccessData = useCallback(async () => {
    setAccessError(null)
    try {
      const [tripsRes, accessRes] = await Promise.all([
        serverApi.tracking.shareableTrips(),
        serverApi.tracking.officeAccess.list(),
      ])
      setAccessTrips(tripsRes.list ?? [])
      setAccessList(accessRes.list ?? [])
      setAccessTripId((prev) => prev || tripsRes.list?.[0]?.id || '')
      setAccessOfficeId((prev) => prev || offices[0]?.id || '')
    } catch (e) {
      setAccessError(e instanceof Error ? e.message : 'فشل تحميل سماح المكاتب')
    }
  }, [offices])

  const openAccessModal = () => {
    setAccessOpen(true)
    void loadAccessData()
  }

  const createAccess = async () => {
    if (!accessTripId) {
      setAccessError('اختر الرحلة أولاً')
      return
    }
    if (!accessOfficeId) {
      setAccessError('اختر المكتب أولاً')
      return
    }
    setAccessBusy(true)
    setAccessError(null)
    try {
      const res = await serverApi.tracking.officeAccess.create({
        tripId: accessTripId,
        officeId: accessOfficeId,
      })
      setAccessList((prev) => [res.access, ...prev.filter((a) => a.id !== res.access.id)])
    } catch (e) {
      setAccessError(e instanceof Error ? e.message : 'فشل إضافة السماح')
    } finally {
      setAccessBusy(false)
    }
  }

  const deleteAccess = async (id: string) => {
    if (!window.confirm('إلغاء سماح المكتب بتتبع هذه الرحلة؟')) return
    setAccessBusy(true)
    setAccessError(null)
    try {
      await serverApi.tracking.officeAccess.remove(id)
      setAccessList((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      setAccessError(e instanceof Error ? e.message : 'فشل إلغاء السماح')
    } finally {
      setAccessBusy(false)
    }
  }

  const points = useMemo(
    () => list.map((i) => ({ lat: i.lat, lng: i.lng })),
    [list],
  )

  const tripKey = useMemo(
    () =>
      [...list.map((i) => i.tripId)]
        .sort()
        .join('|'),
    [list],
  )

  const counts = useMemo(() => {
    let live = 0
    let interrupted = 0
    let stopped = 0
    for (const item of list) {
      const s = trackStatus(item)
      if (s === 'live') live += 1
      else if (s === 'interrupted') interrupted += 1
      else stopped += 1
    }
    return { live, interrupted, stopped }
  }, [list])

  const center: [number, number] = points[0]
    ? [points[0].lat, points[0].lng]
    : [15.3694, 44.191]

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>تتبع الباصات</h1>
          <p>
            كل الرحلات على الخريطة · مباشر {counts.live} · انقطع {counts.interrupted} · متوقف{' '}
            {counts.stopped}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={openAccessModal}>
            سماح للمكتب
          </button>
          <button type="button" className="btn btn-primary" onClick={openShareModal}>
            رابط التتبع
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
            تحديث الآن
          </button>
        </div>
      </header>

      {error && <p className="error-msg">{error}</p>}

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 'min(70vh, 640px)', width: '100%' }}>
          {!loading && (
            <MapContainer
              center={center}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={points} tripKey={tripKey} />
              {list.map((item) => {
                const status = trackStatus(item)
                const busNo = item.trip.busNumber || item.trip.plateNumber || '؟'
                return (
                  <Marker
                    key={item.tripId}
                    position={[item.lat, item.lng]}
                    icon={busMarkerIcon(busNo, status)}
                  >
                    <Popup>
                      <div style={{ minWidth: 190, direction: 'rtl', textAlign: 'right' }}>
                        <strong>
                          باص {item.trip.busNumber || '—'} — {item.trip.plateNumber}
                        </strong>
                        <div>{item.trip.label || '—'}</div>
                        <div>السائق: {item.trip.driverName}</div>
                        <div>
                          الحالة:{' '}
                          <span style={{ color: statusColor(status), fontWeight: 700 }}>
                            {statusLabel(status)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          آخر تحديث: {item.updatedAt.slice(0, 19).replace('T', ' ')}
                          {item.trip.departureTime
                            ? ` · انطلاق ${formatTimeAr(item.trip.departureTime)}`
                            : ''}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          )}
          {loading && (
            <div className="empty" style={{ padding: '3rem' }}>
              جاري تحميل الخريطة…
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h2>الرحلات على الخريطة ({list.length})</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الباص</th>
                <th>الرحلة</th>
                <th>السائق</th>
                <th>آخر تحديث</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const status = trackStatus(item)
                return (
                  <tr key={item.tripId}>
                    <td>
                      {[item.trip.busNumber, item.trip.plateNumber].filter(Boolean).join(' — ')}
                    </td>
                    <td>{item.trip.label || '—'}</td>
                    <td>{item.trip.driverName}</td>
                    <td>{item.updatedAt.slice(0, 19).replace('T', ' ')}</td>
                    <td>
                      <span
                        className={`badge ${
                          status === 'live'
                            ? 'badge-ok'
                            : status === 'interrupted'
                              ? 'badge-warn'
                              : 'badge-danger'
                        }`}
                      >
                        {statusLabel(status)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="empty">
                    لا توجد مواقع خلال آخر 24 ساعة — يبدأ التتبع من صفحة السائق في المتصفح
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {shareOpen && (
        <div className="modal-backdrop" onClick={() => setShareOpen(false)}>
          <div
            className="modal modal-wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720 }}
          >
            <h2>رابط تتبع الرحلة</h2>
            <p style={{ marginTop: 0, opacity: 0.85 }}>
              أنشئ رابطاً وأرسله لأي شخص لعرض خريطة تتبع باص أسطول المسافر بدون تسجيل دخول.
            </p>

            {shareError && <p className="error-msg">{shareError}</p>}

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>اختر الرحلة</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  disabled={shareBusy}
                >
                  <option value="">— اختر —</option>
                  {shareTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {[t.busNumber, t.plateNumber].filter(Boolean).join(' — ')} · {t.label} ·{' '}
                      {t.date} {t.departureTime ? formatTimeAr(t.departureTime) : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={shareBusy || !selectedTripId}
                onClick={() => void createShare()}
              >
                إنشاء رابط تتبع
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={shareBusy}
                onClick={() => void loadShareData()}
              >
                تحديث القائمة
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShareOpen(false)}>
                إغلاق
              </button>
            </div>

            {lastCreatedUrl && (
              <div
                className="panel"
                style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#f0fdfa' }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>الرابط</div>
                <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{lastCreatedUrl}</code>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(lastCreatedUrl).then(() => {
                        setCopiedId('last')
                      })
                    }}
                  >
                    {copiedId === 'last' ? 'تم النسخ' : 'نسخ الرابط'}
                  </button>
                </div>
              </div>
            )}

            <div className="panel-head" style={{ padding: 0, marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>الروابط المستخرجة ({shares.length})</h3>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>الرحلة</th>
                    <th>الحالة</th>
                    <th>تاريخ الإنشاء</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div>
                          {[s.trip.busNumber, s.trip.plateNumber].filter(Boolean).join(' — ')}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{s.trip.label}</div>
                      </td>
                      <td>
                        <span className={`badge ${s.active ? 'badge-ok' : 'badge-danger'}`}>
                          {s.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {s.createdAt.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={shareBusy}
                            onClick={() => void copyShare(s)}
                          >
                            {copiedId === s.id ? 'تم النسخ' : 'نسخ'}
                          </button>
                          {s.active ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={shareBusy}
                              onClick={() => void stopShare(s.id)}
                            >
                              إيقاف
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={shareBusy}
                              onClick={() => void resumeShare(s.id)}
                            >
                              استئناف
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={shareBusy}
                            onClick={() => void deleteShare(s.id)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {shares.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        لا توجد روابط بعد — أنشئ رابطاً من القائمة أعلاه
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {accessOpen && (
        <div className="modal-backdrop" onClick={() => setAccessOpen(false)}>
          <div
            className="modal modal-wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720 }}
          >
            <h2>سماح مكتب بتتبع رحلة</h2>
            <p style={{ marginTop: 0, opacity: 0.85 }}>
              اختر الرحلة والمكتب المسموح له بمشاهدة خريطة التتبع من صفحة المكتب.
            </p>

            {accessError && <p className="error-msg">{accessError}</p>}

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label>الرحلة</label>
                <select
                  value={accessTripId}
                  onChange={(e) => setAccessTripId(e.target.value)}
                  disabled={accessBusy}
                >
                  <option value="">— اختر —</option>
                  {accessTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {[t.busNumber, t.plateNumber].filter(Boolean).join(' — ')} · {t.label} ·{' '}
                      {t.date} {t.departureTime ? formatTimeAr(t.departureTime) : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>المكتب</label>
                <select
                  value={accessOfficeId}
                  onChange={(e) => setAccessOfficeId(e.target.value)}
                  disabled={accessBusy}
                >
                  <option value="">— اختر —</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={accessBusy || !accessTripId || !accessOfficeId}
                onClick={() => void createAccess()}
              >
                إضافة السماح
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={accessBusy}
                onClick={() => void loadAccessData()}
              >
                تحديث القائمة
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAccessOpen(false)}>
                إغلاق
              </button>
            </div>

            <div className="panel-head" style={{ padding: 0, marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                المكاتب المسموح لها ({accessList.length})
              </h3>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>الرحلة</th>
                    <th>المكتب</th>
                    <th>تاريخ السماح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accessList.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div>
                          {[a.trip.busNumber, a.trip.plateNumber].filter(Boolean).join(' — ')}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{a.trip.label}</div>
                      </td>
                      <td>
                        {a.officeName}
                        {a.officeCity ? ` — ${a.officeCity}` : ''}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {a.createdAt.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={accessBusy}
                          onClick={() => void deleteAccess(a.id)}
                        >
                          إلغاء
                        </button>
                      </td>
                    </tr>
                  ))}
                  {accessList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        لا يوجد سماح بعد — أضف رحلة ومكتباً أعلاه
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
