import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { getActiveTripId, pingLocation } from './api'

export const LOCATION_TASK = 'austul-bus-tracking'

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('location task error', error)
    return
  }
  const tripId = await getActiveTripId()
  if (!tripId) return

  const locations = (data as { locations?: Location.LocationObject[] })?.locations
  const loc = locations?.[0]
  if (!loc) return

  try {
    await pingLocation({
      tripId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      heading: loc.coords.heading,
    })
  } catch (e) {
    console.warn('ping failed', e)
  }
})

export async function ensureLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    throw new Error('يجب السماح بالوصول للموقع')
  }
  const bg = await Location.requestBackgroundPermissionsAsync()
  if (bg.status !== 'granted') {
    throw new Error('يجب السماح بالموقع في الخلفية لاستمرار التتبع')
  }
}

export async function startBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  if (started) return

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 20,
    deferredUpdatesInterval: 10000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'تتبع الرحلة نشط',
      notificationBody: 'جاري إرسال موقع الباص للمنصة',
      notificationColor: '#0f766e',
    },
  })
}

export async function stopBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK)
  }
}
