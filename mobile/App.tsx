import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  ApiError,
  DriverTrip,
  fetchMyTrips,
  getApiUrl,
  getToken,
  login,
  setActiveTripId,
  setApiUrl,
  setToken,
  stopTracking,
} from './src/api'
import {
  ensureLocationPermissions,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './src/tracking'

type UserInfo = { name: string }

export default function App() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiUrl, setApiUrlState] = useState('')
  const [showApi, setShowApi] = useState(false)
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [activeTripId, setActive] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const refreshTrips = useCallback(async () => {
    const list = await fetchMyTrips()
    setTrips(list)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setApiUrlState(await getApiUrl())
        const token = await getToken()
        if (token) {
          setUser({ name: 'سائق' })
          await refreshTrips()
        }
      } catch {
        await setToken(null)
        setUser(null)
      } finally {
        setBooting(false)
      }
    })()
  }, [refreshTrips])

  const onLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      if (apiUrl.trim()) await setApiUrl(apiUrl.trim())
      const u = await login(username.trim(), password)
      setUser({ name: u.name })
      await refreshTrips()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'فشل الدخول')
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    if (activeTripId) {
      try {
        await stopTracking(activeTripId)
      } catch {
        /* ignore */
      }
      await stopBackgroundTracking()
      await setActiveTripId(null)
      setActive(null)
    }
    await setToken(null)
    setUser(null)
    setTrips([])
  }

  const startTrip = async (trip: DriverTrip) => {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await ensureLocationPermissions()
      if (activeTripId && activeTripId !== trip.id) {
        await stopTracking(activeTripId)
        await stopBackgroundTracking()
      }
      await setActiveTripId(trip.id)
      setActive(trip.id)
      await startBackgroundTracking()
      setStatus(`التتبع يعمل للرحلة: ${trip.label || trip.plateNumber}`)
      await refreshTrips()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء التتبع')
      await setActiveTripId(null)
      setActive(null)
    } finally {
      setBusy(false)
    }
  }

  const stopTrip = async () => {
    if (!activeTripId) return
    setBusy(true)
    setError(null)
    try {
      await stopTracking(activeTripId)
      await stopBackgroundTracking()
      await setActiveTripId(null)
      setActive(null)
      setStatus('تم إيقاف التتبع')
      await refreshTrips()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إيقاف التتبع')
    } finally {
      setBusy(false)
    }
  }

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.card}>
          <Text style={styles.title}>تتبع الباص</Text>
          <Text style={styles.sub}>أسطول المسافر — حساب السائق</Text>

          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable onPress={() => setShowApi((v) => !v)}>
            <Text style={styles.link}>{showApi ? 'إخفاء عنوان السيرفر' : 'إعداد عنوان السيرفر'}</Text>
          </Pressable>
          {showApi && (
            <>
              <Text style={styles.label}>API URL</Text>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrlState}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.btn} onPress={() => void onLogin()} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'جاري الدخول…' : 'دخول'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>مرحباً {user.name}</Text>
          <Text style={styles.sub}>اختر رحلة وابدأ إرسال الموقع</Text>
        </View>
        <Pressable onPress={() => void onLogout()}>
          <Text style={styles.link}>خروج</Text>
        </Pressable>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {activeTripId && (
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => void stopTrip()} disabled={busy}>
          <Text style={styles.btnText}>إيقاف التتبع</Text>
        </Pressable>
      )}

      <Pressable style={styles.refresh} onPress={() => void refreshTrips()} disabled={busy}>
        <Text style={styles.link}>تحديث الرحلات</Text>
      </Pressable>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد رحلات متاحة اليوم</Text>}
        renderItem={({ item }) => {
          const active = activeTripId === item.id
          return (
            <View style={[styles.trip, active && styles.tripActive]}>
              <Text style={styles.tripTitle}>{item.label || 'رحلة'}</Text>
              <Text style={styles.tripMeta}>
                {[item.busNumber, item.plateNumber].filter(Boolean).join(' — ')}
              </Text>
              <Text style={styles.tripMeta}>
                {item.date} · {item.departureTime} · {item.status}
              </Text>
              <Pressable
                style={[styles.btn, active ? styles.btnMuted : null]}
                disabled={busy || active}
                onPress={() => void startTrip(item)}
              >
                <Text style={styles.btnText}>{active ? 'التتبع يعمل…' : 'بدء التتبع'}</Text>
              </Pressable>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7f8', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginTop: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#d9e2e6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0c1a24', textAlign: 'right' },
  sub: { color: '#5b6b73', marginTop: 4, textAlign: 'right' },
  label: { marginTop: 8, color: '#334155', textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    textAlign: 'right',
  },
  btn: {
    marginTop: 10,
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDanger: { backgroundColor: '#b91c1c' },
  btnMuted: { backgroundColor: '#64748b' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: '#0f766e', fontWeight: '600', textAlign: 'right' },
  error: { color: '#b91c1c', marginTop: 8, textAlign: 'right' },
  status: {
    backgroundColor: '#ccfbf1',
    color: '#115e59',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    textAlign: 'right',
  },
  refresh: { marginBottom: 8, alignSelf: 'flex-end' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  trip: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripActive: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  tripTitle: { fontSize: 16, fontWeight: '700', textAlign: 'right', color: '#0f172a' },
  tripMeta: { color: '#64748b', textAlign: 'right', marginTop: 4 },
})
