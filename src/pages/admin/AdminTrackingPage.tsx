import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { serverApi } from '../../api/serverApi'
import { formatTimeAr } from '../../components/utils'

// إصلاح أيقونة Leaflet الافتراضية مع Vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type LiveItem = Awaited<ReturnType<typeof serverApi.tracking.live>>['list'][number]

const freshIcon = new L.DivIcon({
  className: 'bus-marker-fresh',
  html: `<div style="background:#0f766e;color:#fff;border-radius:999px;width:28px;height:28px;display:grid;place-items:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">🚌</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const staleIcon = new L.DivIcon({
  className: 'bus-marker-stale',
  html: `<div style="background:#b45309;color:#fff;border-radius:999px;width:28px;height:28px;display:grid;place-items:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">🚌</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
  }, [map, points])
  return null
}

function isStale(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() > 2 * 60 * 1000
}

export function AdminTrackingPage() {
  const [list, setList] = useState<LiveItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const points = useMemo(
    () => list.map((i) => ({ lat: i.lat, lng: i.lng })),
    [list],
  )

  const center: [number, number] = points[0]
    ? [points[0].lat, points[0].lng]
    : [15.3694, 44.191]

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>تتبع الباصات</h1>
          <p>المواقع الحية من تطبيق السائق — يتحدث كل 5 ثوانٍ</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
          تحديث الآن
        </button>
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
              <FitBounds points={points} />
              {list.map((item) => (
                <Marker
                  key={item.tripId}
                  position={[item.lat, item.lng]}
                  icon={isStale(item.updatedAt) ? staleIcon : freshIcon}
                >
                  <Popup>
                    <div style={{ minWidth: 180, direction: 'rtl', textAlign: 'right' }}>
                      <strong>
                        {item.trip.busNumber || item.trip.plateNumber} — {item.trip.plateNumber}
                      </strong>
                      <div>{item.trip.label || '—'}</div>
                      <div>السائق: {item.trip.driverName}</div>
                      <div>
                        الحالة:{' '}
                        {isStale(item.updatedAt) ? (
                          <span style={{ color: '#b45309' }}>تحديث قديم</span>
                        ) : (
                          <span style={{ color: '#0f766e' }}>مباشر</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        آخر تحديث:{' '}
                        {item.updatedAt.slice(0, 16).replace('T', ' ')}{' '}
                        {item.trip.departureTime
                          ? `· انطلاق ${formatTimeAr(item.trip.departureTime)}`
                          : ''}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
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
          <h2>الباصات النشطة ({list.length})</h2>
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
              {list.map((item) => (
                <tr key={item.tripId}>
                  <td>
                    {[item.trip.busNumber, item.trip.plateNumber].filter(Boolean).join(' — ')}
                  </td>
                  <td>{item.trip.label || '—'}</td>
                  <td>{item.trip.driverName}</td>
                  <td>{item.updatedAt.slice(0, 19).replace('T', ' ')}</td>
                  <td>
                    <span
                      className={`badge ${isStale(item.updatedAt) ? 'badge-warn' : 'badge-ok'}`}
                    >
                      {isStale(item.updatedAt) ? 'قديمة' : 'مباشر'}
                    </span>
                  </td>
                </tr>
              ))}
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="empty">
                    لا يوجد تتبع نشط حالياً — يبدأ عندما يفتح السائق التطبيق ويبدأ الإرسال
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
