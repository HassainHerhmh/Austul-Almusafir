import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
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
  getActiveTripId,
  getSavedUserName,
  getToken,
  login,
  reportClientIssue,
  setActiveTripId,
  setSavedUserName,
  setToken,
  stopTracking,
  type ClientIssueCode,
} from './src/api'
import { startTracking, stopBackgroundTracking, requestBatteryUnrestricted, PermissionNeededError } from './src/tracking'
import {
  hideTrackingNotification,
  setupTrackingNotifications,
  showTrackingNotification,
  startNotificationGuard,
  stopNotificationGuard,
} from './src/trackingNotify'

type UserInfo = { name: string }

function formatTimeAr(time: string | null | undefined) {
  if (!time) return '—'
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return time
  let h = Number(m[1])
  const min = m[2]
  if (!Number.isFinite(h) || h < 0 || h > 23) return time
  const period = h < 12 ? 'صباحاً' : 'مساءً'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return min === '00' ? `${h12} ${period}` : `${h12}:${min} ${period}`
}

function greetingByHour(name: string) {
  const h = new Date().getHours()
  const greet = h >= 5 && h < 17 ? 'صباح الخير' : 'مساء الخير'
  return `${greet} ${name}`
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [activeTripId, setActive] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const refreshTrips = useCallback(async () => {
    try {
      const list = await fetchMyTrips()
      setTrips(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken(null)
        await setSavedUserName(null)
        setUser(null)
        setError('انتهت الجلسة — أعد تسجيل الدخول')
      }
      throw e
    }
  }, [])

  useEffect(() => {
    void setupTrackingNotifications(() => {
      setActive(null)
      setStatus('تم إيقاف التتبع من الإشعار')
      void refreshTrips().catch(() => undefined)
    })
  }, [refreshTrips])

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return

        const name = await getSavedUserName()
        setUser({ name })

        try {
          await refreshTrips()
        } catch {
          /* الرحلات اختيارية عند الإقلاع */
        }

        const tripId = await getActiveTripId()
        if (tripId) {
          setActive(tripId)
          try {
            await startTracking(tripId)
            const trip = (await fetchMyTrips().catch(() => []))?.find((t) => t.id === tripId)
            const label = trip?.label || trip?.plateNumber || 'رحلة'
            await showTrackingNotification(label)
            startNotificationGuard(label)
            setStatus('تم استئناف التتبع — يظهر إشعار مستمر في الشريط')
          } catch {
            setStatus('تعذر استئناف التتبع تلقائياً — اضغط بدء التتبع')
          }
        }
      } catch {
        await setToken(null)
        setUser(null)
      } finally {
        setBooting(false)
      }
    })()
  }, [refreshTrips])

  // عند العودة للتطبيق حدّث الرحلات بهدوء
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) {
        void refreshTrips().catch(() => undefined)
      }
    })
    return () => sub.remove()
  }, [user, refreshTrips])

  const onLogin = async () => {
    setBusy(true)
    setError(null)
    try {
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
    setBusy(true)
    try {
      if (activeTripId) {
        try {
          await stopTracking(activeTripId)
        } catch {
          /* ignore */
        }
      }
      await stopBackgroundTracking()
      stopNotificationGuard()
      await hideTrackingNotification()
      await setActiveTripId(null)
      setActive(null)
      await setToken(null)
      await setSavedUserName(null)
      setUser(null)
      setTrips([])
      setStatus(null)
      setError(null)
    } finally {
      setBusy(false)
    }
  }

  const classifyIssue = (e: unknown): { code: ClientIssueCode; message: string } => {
    const message = e instanceof Error ? e.message : 'تعذر بدء التتبع'
    if (e instanceof PermissionNeededError) {
      if (/GPS|خدمة الموقع|مغلقة/.test(message)) {
        return { code: 'gps_off', message }
      }
      if (/خلفية|دائماً|background/i.test(message)) {
        return { code: 'background_denied', message }
      }
      return { code: 'permission_denied', message }
    }
    if (/بطارية|battery/i.test(message)) return { code: 'battery', message }
    return { code: 'send_failed', message }
  }

  const startTrip = async (trip: DriverTrip) => {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      if (activeTripId && activeTripId !== trip.id) {
        await stopBackgroundTracking()
        stopNotificationGuard()
        await hideTrackingNotification()
        try {
          await stopTracking(activeTripId)
        } catch {
          /* ignore */
        }
        await setActiveTripId(null)
      }

      await setActiveTripId(trip.id)
      setActive(trip.id)

      await setupTrackingNotifications(() => {
        setActive(null)
        setStatus('تم إيقاف التتبع من الإشعار')
      })
      await startTracking(trip.id)
      await showTrackingNotification(trip.label || trip.plateNumber || 'رحلة')
      startNotificationGuard(trip.label || trip.plateNumber || 'رحلة')
      // طلب استثناء البطارية مرة عند أول تشغيل تتبع
      void requestBatteryUnrestricted()

      setStatus(
        `التتبع يعمل في الخلفية مع إشعار ثابت. لا تمسح الإشعار — للإيقاف استخدم زر «إيقاف التتبع» فقط.`,
      )
      await refreshTrips().catch(() => undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر بدء التتبع'
      setError(msg)
      const issue = classifyIssue(e)
      await reportClientIssue(trip.id, issue.code, issue.message)
      await setActiveTripId(null)
      setActive(null)
      await stopBackgroundTracking()
      stopNotificationGuard()
      await hideTrackingNotification()

      const needSettings = e instanceof PermissionNeededError && e.openSettings
      Alert.alert(
        'يلزم السماح للمتابعة',
        msg,
        needSettings
          ? [
              { text: 'لاحقاً', style: 'cancel' },
              {
                text: 'فتح الإعدادات',
                onPress: () => {
                  void Linking.openSettings()
                },
              },
            ]
          : [{ text: 'حسناً' }],
      )
    } finally {
      setBusy(false)
    }
  }

  const stopTrip = async () => {
    if (!activeTripId) return
    const tripId = activeTripId
    setBusy(true)
    setError(null)
    try {
      // أوقف الإرسال المحلي أولاً حتى لا تُعاد تفعيل الرحلة بنبضة متأخرة
      await stopBackgroundTracking()
      stopNotificationGuard()
      await hideTrackingNotification()
      await setActiveTripId(null)
      setActive(null)

      let stopped = false
      for (let i = 0; i < 2 && !stopped; i++) {
        try {
          await stopTracking(tripId)
          stopped = true
        } catch {
          if (i === 0) await new Promise((r) => setTimeout(r, 400))
        }
      }
      if (!stopped) {
        setError('تم الإيقاف على الجهاز، لكن تعذر إبلاغ المنصة — أعد المحاولة عند توفر الشبكة')
      } else {
        setStatus('تم إيقاف التتبع')
      }
      await refreshTrips().catch(() => undefined)
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
        <Pressable
          style={[styles.logoutBtn, busy && styles.logoutBtnDisabled]}
          onPress={() => void onLogout()}
          disabled={busy}
        >
          <Text style={styles.logoutBtnText}>خروج</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{greetingByHour(user.name)}</Text>
          <Text style={styles.sub}>اختر رحلة وابدأ إرسال الموقع</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        التتبع يستمر مع إشعار في الشريط حتى بعد قفل الشاشة. اسمح بالموقع «دائماً»، ولا تضع التطبيق في السكون
        العميق، واضغط «سماح» لاستثناء البطارية عند الطلب. للإيقاف: زر في التطبيق أو «إيقاف التتبع» من الإشعار.
      </Text>

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {activeTripId && (
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => void stopTrip()} disabled={busy}>
          <Text style={styles.btnText}>إيقاف التتبع</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.refresh}
        onPress={() => {
          setError(null)
          void refreshTrips().catch((e) =>
            setError(e instanceof Error ? e.message : 'فشل التحديث'),
          )
        }}
        disabled={busy}
      >
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
                {item.date} · {formatTimeAr(item.departureTime)} · {item.status}
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
    direction: 'ltr',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0c1a24', textAlign: 'right' },
  sub: { color: '#5b6b73', marginTop: 4, textAlign: 'right', fontSize: 13 },
  logoutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logoutBtnDisabled: { opacity: 0.55 },
  logoutBtnText: { color: '#be123c', fontWeight: '700', fontSize: 14 },
  hint: {
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 20,
  },
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
