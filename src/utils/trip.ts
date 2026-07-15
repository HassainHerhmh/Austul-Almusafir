import type { Trip, TripStop } from '../types'

type LegacyTrip = Trip & {
  fromId?: string
  toId?: string
  fromPoint?: string
  toPoint?: string
  assistantDriverId?: string | null
  assistantName?: string
  assistantPhone?: string
  pricingMode?: 'trip' | 'boarding'
  legs?: Array<{
    fromId: string
    toId: string
    fromPoint?: string
    toPoint?: string
  }>
  stops?: TripStop[]
}

/** ترحيل أي شكل قديم إلى سلسلة محطات */
export function normalizeTrip(trip: LegacyTrip): Trip {
  let stops: TripStop[] = []

  if (trip.stops?.length) {
    stops = trip.stops.map((s) => ({
      destinationId: s.destinationId,
      point: s.point ?? '',
    }))
  } else if (trip.legs?.length) {
    const first = trip.legs[0]
    stops = [
      { destinationId: first.fromId, point: first.fromPoint ?? '' },
      ...trip.legs.map((leg) => ({
        destinationId: leg.toId,
        point: leg.toPoint ?? '',
      })),
    ]
  } else if (trip.fromId || trip.toId) {
    stops = [
      { destinationId: trip.fromId ?? '', point: trip.fromPoint ?? '' },
      { destinationId: trip.toId ?? '', point: trip.toPoint ?? '' },
    ]
  }

  if (stops.length < 2) {
    stops = [
      { destinationId: '', point: '' },
      { destinationId: '', point: '' },
    ]
  }

  return {
    id: trip.id,
    busId: trip.busId,
    driverId: trip.driverId,
    assistantName: trip.assistantName ?? '',
    assistantPhone: trip.assistantPhone ?? '',
    pricingMode: trip.pricingMode === 'boarding' ? 'boarding' : 'trip',
    date: trip.date,
    departureTime: trip.departureTime,
    price: trip.price,
    status: (['scheduled', 'open', 'closed', 'departed', 'cancelled', 'completed'] as const).includes(
      trip.status as never,
    )
      ? (trip.status as Trip['status'])
      : 'scheduled',
    stops,
  }
}

export function emptyStop(destinationId = ''): TripStop {
  return { destinationId, point: '' }
}

export function reverseStops(stops: TripStop[]): TripStop[] {
  return [...stops].reverse()
}

export function tripEndpoints(trip: Trip) {
  const first = trip.stops[0]
  const last = trip.stops[trip.stops.length - 1]
  return {
    fromId: first?.destinationId ?? '',
    toId: last?.destinationId ?? '',
    fromPoint: first?.point ?? '',
    toPoint: last?.point ?? '',
  }
}

export function tripRouteLabel(
  trip: Trip,
  getName: (id: string) => string | undefined,
): string {
  return trip.stops.map((s) => getName(s.destinationId) ?? '?').join(' ← ')
}

export function tripRoutePoints(trip: Trip): string {
  return trip.stops
    .map((s) => s.point)
    .filter(Boolean)
    .join(' ← ')
}
