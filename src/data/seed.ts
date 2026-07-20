import type { AppState } from '../types'
import { normalizeTrip } from '../utils/trip'

export const STORAGE_KEY = 'austul-almusafir-data-v3'

/** حالة فارغة — بدون بيانات تجريبية. حساب المدير فقط لبدء التشغيل. */
export const seedData: AppState = {
  currentUserId: null,

  destinations: [],
  visaTypes: [],
  offices: [],
  users: [
    {
      id: 'usr-admin',
      username: 'admin',
      password: 'admin123',
      name: 'مدير أسطول المسافر',
      phone: '',
      role: 'admin',
      officeId: null,
      driverId: null,
      active: true,
    },
  ],
  buses: [],
  drivers: [],
  trips: [],
  customers: [],
  bookings: [],
  vouchers: [],
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      return {
        ...parsed,
        currentUserId: null,
        offices: (parsed.offices ?? []).map((o) => ({
          ...o,
          ledgerAccountId: o.ledgerAccountId ?? null,
          commissionPercent: Number(o.commissionPercent) || 0,
        })),
        customers: (parsed.customers ?? []).map((c) => ({
          ...c,
          passportNumber: c.passportNumber ?? '',
        })),
        destinations: (parsed.destinations ?? []).map((d) => ({
          ...d,
          ticketPrice: Number(d.ticketPrice) || 0,
        })),
        visaTypes: parsed.visaTypes ?? [],
        bookings: (parsed.bookings ?? []).map((b) => ({
          ...b,
          bookingNumber: b.bookingNumber ?? null,
          ticketNumber: b.ticketNumber ?? '',
          passportNumber: b.passportNumber ?? '',
          visaTypeId: b.visaTypeId ?? '',
          notes: b.notes ?? '',
          boardingDestinationId: b.boardingDestinationId ?? '',
          arrivalDestinationId: b.arrivalDestinationId ?? '',
        })),
        drivers: (parsed.drivers ?? []).map((d) => ({
          ...d,
          role: d.role === 'assistant' ? ('assistant' as const) : ('primary' as const),
        })),
        trips: (parsed.trips ?? []).map((t) =>
          normalizeTrip(t as Parameters<typeof normalizeTrip>[0]),
        ),
        users: (parsed.users?.length ? parsed.users : seedData.users).map((u) => ({
          ...u,
          phone: u.phone ?? '',
        })),
      }
    }
  } catch {
    /* ignore */
  }
  return structuredClone(seedData)
}

export function saveState(state: AppState) {
  const { currentUserId: _, ...rest } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
}

export function resetState(): AppState {
  localStorage.removeItem(STORAGE_KEY)
  return structuredClone(seedData)
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
