import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { ApiError } from '../../api/client'
import { serverApi } from '../../api/serverApi'
import { useBrand } from '../../context/BrandContext'
import { formatTimeAr } from '../../components/utils'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type PublicTrack = Awaited<ReturnType<typeof serverApi.tracking.publicByToken>>

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusMeta(status: PublicTrack['status']) {
  if (status === 'live') return { label: 'مباشر', color: '#0f766e' }
  if (status === 'no_signal') return { label: 'انقطع الإرسال', color: '#b45309' }
  return { label: 'متوقف', color: '#64748b' }
}

function busIcon(busNumber: string, color: string) {
  const label = escapeHtml((busNumber || '؟').trim() || '؟')
  return new L.DivIcon({
    className: 'bus-map-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.1;pointer-events:none;">
      <div style="background:#fff;color:#0c1a24;font-weight:800;font-size:12px;padding:2px 7px;border-radius:8px;border:2px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,.28);white-space:nowrap;margin-bottom:3px;">${label}</div>
      <div style="background:${color};color:#fff;border-radius:999px;width:30px;height:30px;display:grid;place-items:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">🚌</div>
    </div>`,
    iconSize: [72, 54],
    iconAnchor: [36, 50],
  })
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      map.setView([lat, lng], 13)
      first.current = false
    } else {
      map.panTo([lat, lng])
    }
  }, [map, lat, lng])
  return null
}

export function PublicTripTrackPage() {
  const { token = '' } = useParams<{ token: string }>()
  const brand = useBrand()
  const [data, setData] = useState<PublicTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!token) {
      setError('رابط التتبع غير صالح')
      setLoading(false)
      return
    }
    try {
      const res = await serverApi.tracking.publicByToken(token)
      setData(res)
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setData(null)
        setError(e.message || 'رابط التتبع غير موجود أو تم حذفه')
      } else {
        setError(e instanceof Error ? e.message : 'تعذر تحميل التتبع')
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const shareRevoked = !!data && data.status === 'stopped' && data.lat == null
  const showMap =
    !!data &&
    !shareRevoked &&
    typeof data.lat === 'number' &&
    typeof data.lng === 'number'
  const meta = data ? statusMeta(data.status) : null

  return (
    <div
      style={{
        minHeight: '100vh',
        direction: 'rtl',
        background: 'linear-gradient(165deg, #e8f4f2 0%, #f7fafc 45%, #eef2f6 100%)',
        color: '#0c1a24',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}
    >
      <header
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          borderBottom: '1px solid rgba(15, 61, 76, 0.12)',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 10 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#0f3d4c',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            أ
          </div>
        )}
        <div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {brand.name || 'أسطول المسافر'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>تتبع رحلة مباشر</div>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.8 }}>جاري التحميل…</div>
        )}

        {!loading && error && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '2rem 1.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 28px rgba(15, 61, 76, 0.08)',
            }}
          >
            <h1 style={{ marginTop: 0, fontSize: '1.35rem' }}>تعذر عرض التتبع</h1>
            <p style={{ marginBottom: 0, opacity: 0.8 }}>{error}</p>
          </div>
        )}

        {!loading && data && shareRevoked && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '2rem 1.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 28px rgba(15, 61, 76, 0.08)',
            }}
          >
            <h1 style={{ marginTop: 0, fontSize: '1.35rem' }}>توقف عرض التتبع</h1>
            <p style={{ marginBottom: 0, opacity: 0.8 }}>
              {data.message || 'تم إيقاف رابط التتبع — لم يعد عرض الموقع متاحاً'}
            </p>
          </div>
        )}

        {!loading && data && !shareRevoked && (
          <>
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: '1rem 1.15rem',
                marginBottom: '1rem',
                boxShadow: '0 8px 28px rgba(15, 61, 76, 0.08)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                باص {data.busNumber || '—'}
                {data.plateNumber ? ` — ${data.plateNumber}` : ''}
              </div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{data.label}</div>
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                  fontSize: 14,
                }}
              >
                {meta && (
                  <span
                    style={{
                      background: meta.color,
                      color: '#fff',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 13,
                    }}
                  >
                    {meta.label}
                  </span>
                )}
                {data.date && (
                  <span style={{ opacity: 0.75 }}>
                    {data.date}
                    {data.departureTime ? ` · ${formatTimeAr(data.departureTime)}` : ''}
                  </span>
                )}
                {data.updatedAt && (
                  <span style={{ opacity: 0.65 }}>
                    آخر تحديث: {data.updatedAt.slice(0, 19).replace('T', ' ')}
                  </span>
                )}
              </div>
              {data.message && data.status !== 'live' && (
                <p style={{ margin: '0.75rem 0 0', fontSize: 14, color: meta?.color }}>{data.message}</p>
              )}
            </div>

            {showMap && meta ? (
              <div
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  height: 'min(65vh, 520px)',
                  boxShadow: '0 8px 28px rgba(15, 61, 76, 0.1)',
                  background: '#fff',
                }}
              >
                <MapContainer
                  center={[data.lat!, data.lng!]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Recenter lat={data.lat!} lng={data.lng!} />
                  <Marker
                    position={[data.lat!, data.lng!]}
                    icon={busIcon(data.busNumber || data.plateNumber || '؟', meta.color)}
                  />
                </MapContainer>
              </div>
            ) : (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  opacity: 0.85,
                  boxShadow: '0 8px 28px rgba(15, 61, 76, 0.08)',
                }}
              >
                {data.message || 'لا يتوفر موقع على الخريطة حالياً'}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
