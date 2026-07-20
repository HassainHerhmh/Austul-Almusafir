import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { serverApi } from '../../api/serverApi'
import { formatTimeAr } from '../../components/utils'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type LiveItem = Awaited<ReturnType<typeof serverApi.tracking.officeLive>>['list'][number]
type TrackStatus = 'live' | 'interrupted' | 'stopped'

const STALE_MS = 2 * 60 * 1000
const EMPTY_MSG =
  'لا يوجد لديك رحلات حالية أو انتظر حتى تبدأ الرحلة سيتم ظهور خريطة التتبع'

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

export function OfficeTrackingPage() {
  const [list, setList] = useState<LiveItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await serverApi.tracking.officeLive()
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

  const showEmpty = !loading && list.length === 0
  const center: [number, number] = points[0]
    ? [points[0].lat, points[0].lng]
    : [15.3694, 44.191]

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>تتبع الباصات</h1>
          <p>رحلات مكتبك على الخريطة</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
          تحديث الآن
        </button>
      </header>

      {error && <p className="error-msg">{error}</p>}

      {showEmpty ? (
        <div className="panel">
          <div className="empty" style={{ padding: '3rem 1.5rem', fontSize: '1.05rem' }}>
            {EMPTY_MSG}
          </div>
        </div>
      ) : (
        <>
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
                          <div style={{ minWidth: 180, direction: 'rtl', textAlign: 'right' }}>
                            <strong>
                              باص {item.trip.busNumber || '—'} — {item.trip.plateNumber}
                            </strong>
                            <div>{item.trip.label || '—'}</div>
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
              <h2>الرحلات ({list.length})</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>الباص</th>
                    <th>الرحلة</th>
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
                          {[item.trip.busNumber, item.trip.plateNumber]
                            .filter(Boolean)
                            .join(' — ')}
                        </td>
                        <td>{item.trip.label || '—'}</td>
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
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
