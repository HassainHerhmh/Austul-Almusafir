import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ensureOfficeLedgerAccount,
  getAccountBalance,
  postBookingCharge,
  reverseBookingCharge,
} from '../api/accountingApi'
import { loadState, resetState, saveState, uid } from '../data/seed'
import type {
  AppState,
  Booking,
  Bus,
  Customer,
  Destination,
  Driver,
  Office,
  PaymentMethod,
  Role,
  Trip,
  User,
  Voucher,
} from '../types'

interface AppContextValue {
  state: AppState
  currentUser: User | null
  currentOffice: Office | null
  isAdmin: boolean
  login: (username: string, password: string) => string | null
  logout: () => void
  resetData: () => void
  // Lookups
  getDestination: (id: string) => Destination | undefined
  getBus: (id: string) => Bus | undefined
  getDriver: (id: string) => Driver | undefined
  getOffice: (id: string) => Office | undefined
  getTripLabel: (trip: Trip) => string
  getTripSeats: (tripId: string) => {
    total: number
    booked: number
    remaining: number
    bookedSeats: number[]
  }
  /** الرصيد على المكتب لدى الوكالة (ذمم مدينة) */
  getOfficeAgencyBalance: (officeId?: string) => number
  // Mutations
  upsertOffice: (office: Omit<Office, 'id' | 'createdAt'> & { id?: string }) => void
  upsertUser: (user: Omit<User, 'id'> & { id?: string }) => void
  deleteUser: (id: string) => void
  upsertBus: (bus: Omit<Bus, 'id'> & { id?: string }) => void
  upsertDriver: (driver: Omit<Driver, 'id'> & { id?: string }) => void
  upsertDestination: (dest: Omit<Destination, 'id'> & { id?: string }) => void
  upsertTrip: (trip: Omit<Trip, 'id'> & { id?: string }) => void
  cancelTrip: (id: string) => void
  upsertCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => Customer
  createBooking: (input: {
    tripId: string
    officeId: string
    passengerName: string
    phone: string
    nationalId: string
    passportNumber: string
    seatNumber: number
    paymentMethod: PaymentMethod
    notes?: string
    bookedBy: string
  }) => Booking | string
  updateBooking: (
    id: string,
    patch: Partial<
      Pick<
        Booking,
        'passengerName' | 'passportNumber' | 'seatNumber' | 'status' | 'paymentMethod' | 'notes'
      >
    >,
  ) => string | null
  addVoucher: (voucher: Omit<Voucher, 'id'> & { id?: string }) => void
  can: (action: Permission) => boolean
}

export type Permission =
  | 'manage_system'
  | 'book'
  | 'cancel_booking'
  | 'print_ticket'
  | 'view_accounts'
  | 'manage_office_users'
  | 'view_reports'

const ROLE_PERMS: Record<Role, Permission[]> = {
  admin: [
    'manage_system',
    'book',
    'cancel_booking',
    'print_ticket',
    'view_accounts',
    'manage_office_users',
    'view_reports',
  ],
  office_manager: [
    'book',
    'cancel_booking',
    'print_ticket',
    'view_accounts',
    'manage_office_users',
    'view_reports',
  ],
  booking_clerk: ['book', 'print_ticket'],
  accountant: ['view_accounts', 'view_reports'],
}

const AppContext = createContext<AppContextValue | null>(null)

function persist(next: AppState) {
  saveState(next)
  return next
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [ledgerTick, setLedgerTick] = useState(0)

  const bumpLedger = () => setLedgerTick((n) => n + 1)

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  )

  const currentOffice = useMemo(
    () =>
      currentUser?.officeId
        ? (state.offices.find((o) => o.id === currentUser.officeId) ?? null)
        : null,
    [currentUser, state.offices],
  )

  const isAdmin = currentUser?.role === 'admin'

  const can = useCallback(
    (action: Permission) => {
      if (!currentUser) return false
      return ROLE_PERMS[currentUser.role].includes(action)
    },
    [currentUser],
  )

  const login = (username: string, password: string) => {
    const user = state.users.find(
      (u) => u.username === username.trim() && u.password === password && u.active,
    )
    if (!user) return 'اسم المستخدم أو كلمة المرور غير صحيحة'
    if (user.officeId) {
      const office = state.offices.find((o) => o.id === user.officeId)
      if (!office || office.status === 'suspended') {
        return 'هذا المكتب موقوف حالياً'
      }
    }
    setState((s) => persist({ ...s, currentUserId: user.id }))
    return null
  }

  const logout = () => setState((s) => ({ ...s, currentUserId: null }))

  const resetData = () => setState(persist(resetState()))

  const getDestination = (id: string) => state.destinations.find((d) => d.id === id)
  const getBus = (id: string) => state.buses.find((b) => b.id === id)
  const getDriver = (id: string) => state.drivers.find((d) => d.id === id)
  const getOffice = (id: string) => state.offices.find((o) => o.id === id)

  const getOfficeAgencyBalance = (officeId?: string) => {
    void ledgerTick
    const id = officeId ?? currentOffice?.id
    if (!id) return 0
    const office = state.offices.find((o) => o.id === id)
    return getAccountBalance(office?.ledgerAccountId)
  }

  const getTripLabel = (trip: Trip) => {
    const stops = trip.stops?.length ? trip.stops : []
    if (!stops.length) return '—'
    return stops.map((s) => getDestination(s.destinationId)?.name ?? '?').join(' ← ')
  }

  const getTripSeats = (tripId: string) => {
    const trip = state.trips.find((t) => t.id === tripId)
    const bus = trip ? getBus(trip.busId) : undefined
    const total = bus?.seats ?? 0
    const confirmed = state.bookings.filter(
      (b) => b.tripId === tripId && b.status === 'confirmed',
    )
    return {
      total,
      booked: confirmed.length,
      remaining: Math.max(0, total - confirmed.length),
      bookedSeats: confirmed.map((b) => b.seatNumber),
    }
  }

  const upsertOffice: AppContextValue['upsertOffice'] = (office) => {
    let linkedAccount = false
    setState((s) => {
      if (office.id) {
        const prev = s.offices.find((o) => o.id === office.id)
        let ledgerAccountId = office.ledgerAccountId ?? prev?.ledgerAccountId ?? null
        if (!ledgerAccountId) {
          ledgerAccountId = ensureOfficeLedgerAccount(office.name)
          linkedAccount = true
        }
        return persist({
          ...s,
          offices: s.offices.map((o) =>
            o.id === office.id
              ? { ...o, ...office, id: o.id, createdAt: o.createdAt, ledgerAccountId }
              : o,
          ),
        })
      }
      const ledgerAccountId = office.ledgerAccountId ?? ensureOfficeLedgerAccount(office.name)
      linkedAccount = true
      const created: Office = {
        ...office,
        ledgerAccountId,
        id: uid('off'),
        createdAt: new Date().toISOString().slice(0, 10),
      }
      return persist({ ...s, offices: [...s.offices, created] })
    })
    if (linkedAccount) bumpLedger()
  }

  const upsertUser: AppContextValue['upsertUser'] = (user) => {
    setState((s) => {
      if (user.id) {
        return persist({
          ...s,
          users: s.users.map((u) => (u.id === user.id ? { ...u, ...user, id: u.id } : u)),
        })
      }
      return persist({
        ...s,
        users: [...s.users, { ...user, id: uid('usr') }],
      })
    })
  }

  const deleteUser = (id: string) => {
    setState((s) => persist({ ...s, users: s.users.filter((u) => u.id !== id) }))
  }

  const upsertBus: AppContextValue['upsertBus'] = (bus) => {
    setState((s) => {
      if (bus.id) {
        return persist({
          ...s,
          buses: s.buses.map((b) => (b.id === bus.id ? { ...b, ...bus, id: b.id } : b)),
        })
      }
      return persist({ ...s, buses: [...s.buses, { ...bus, id: uid('bus') }] })
    })
  }

  const upsertDriver: AppContextValue['upsertDriver'] = (driver) => {
    setState((s) => {
      if (driver.id) {
        return persist({
          ...s,
          drivers: s.drivers.map((d) =>
            d.id === driver.id ? { ...d, ...driver, id: d.id } : d,
          ),
        })
      }
      return persist({ ...s, drivers: [...s.drivers, { ...driver, id: uid('drv') }] })
    })
  }

  const upsertDestination: AppContextValue['upsertDestination'] = (dest) => {
    setState((s) => {
      if (dest.id) {
        return persist({
          ...s,
          destinations: s.destinations.map((d) =>
            d.id === dest.id ? { ...d, ...dest, id: d.id } : d,
          ),
        })
      }
      return persist({
        ...s,
        destinations: [...s.destinations, { ...dest, id: uid('dest') }],
      })
    })
  }

  const upsertTrip: AppContextValue['upsertTrip'] = (trip) => {
    setState((s) => {
      if (trip.id) {
        return persist({
          ...s,
          trips: s.trips.map((t) => (t.id === trip.id ? { ...t, ...trip, id: t.id } : t)),
        })
      }
      return persist({ ...s, trips: [...s.trips, { ...trip, id: uid('trip') }] })
    })
  }

  const cancelTrip = (id: string) => {
    setState((s) =>
      persist({
        ...s,
        trips: s.trips.map((t) => (t.id === id ? { ...t, status: 'cancelled' } : t)),
      }),
    )
  }

  const upsertCustomer: AppContextValue['upsertCustomer'] = (customer) => {
    let result: Customer = { ...customer, id: customer.id ?? uid('cust') }
    setState((s) => {
      if (customer.id) {
        const updated = s.customers.map((c) =>
          c.id === customer.id ? { ...c, ...customer, id: c.id } : c,
        )
        result = updated.find((c) => c.id === customer.id)!
        return persist({ ...s, customers: updated })
      }
      const existing = s.customers.find(
        (c) =>
          c.officeId === customer.officeId &&
          (c.phone === customer.phone || c.nationalId === customer.nationalId),
      )
      if (existing) {
        result = {
          ...existing,
          name: customer.name,
          phone: customer.phone,
          nationalId: customer.nationalId,
          passportNumber: customer.passportNumber,
        }
        return persist({
          ...s,
          customers: s.customers.map((c) => (c.id === existing.id ? result : c)),
        })
      }
      result = { ...customer, id: uid('cust') }
      return persist({ ...s, customers: [...s.customers, result] })
    })
    return result
  }

  const createBooking: AppContextValue['createBooking'] = (input) => {
    const seats = getTripSeats(input.tripId)
    if (seats.bookedSeats.includes(input.seatNumber)) {
      return 'هذا المقعد محجوز مسبقاً'
    }
    if (input.seatNumber < 1 || input.seatNumber > seats.total) {
      return 'رقم المقعد غير صالح'
    }
    const trip = state.trips.find((t) => t.id === input.tripId)
    if (!trip || trip.status !== 'scheduled') {
      return 'الرحلة غير متاحة للحجز'
    }

    let created!: Booking

    setState((s) => {
      const existing = s.customers.find(
        (c) =>
          c.officeId === input.officeId &&
          (c.phone === input.phone ||
            c.nationalId === input.nationalId ||
            (input.passportNumber && c.passportNumber === input.passportNumber)),
      )
      let customers = s.customers
      let customerId: string
      if (existing) {
        customerId = existing.id
        customers = s.customers.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                name: input.passengerName,
                phone: input.phone,
                nationalId: input.nationalId,
                passportNumber: input.passportNumber,
              }
            : c,
        )
      } else {
        customerId = uid('cust')
        customers = [
          ...s.customers,
          {
            id: customerId,
            name: input.passengerName,
            phone: input.phone,
            nationalId: input.nationalId,
            passportNumber: input.passportNumber,
            officeId: input.officeId,
          },
        ]
      }

      created = {
        id: uid('bk'),
        tripId: input.tripId,
        officeId: input.officeId,
        customerId,
        passengerName: input.passengerName,
        passportNumber: input.passportNumber,
        seatNumber: input.seatNumber,
        price: trip.price,
        paymentMethod: input.paymentMethod,
        notes: input.notes?.trim() ?? '',
        status: 'confirmed',
        bookedAt: new Date().toISOString(),
        bookedBy: input.bookedBy,
      }

      const voucher: Voucher = {
        id: uid('vch'),
        officeId: input.officeId,
        type: 'receipt',
        amount: trip.price,
        description: `حجز ${input.passengerName} — مقعد ${input.seatNumber}`,
        date: new Date().toISOString().slice(0, 10),
        relatedBookingId: created.id,
      }

      return persist({
        ...s,
        customers,
        bookings: [...s.bookings, created],
        vouchers: [...s.vouchers, voucher],
      })
    })

    const office = state.offices.find((o) => o.id === input.officeId)
    let ledgerAccountId = office?.ledgerAccountId ?? null
    if (!ledgerAccountId && office) {
      ledgerAccountId = ensureOfficeLedgerAccount(office.name)
      setState((s) =>
        persist({
          ...s,
          offices: s.offices.map((o) =>
            o.id === office.id ? { ...o, ledgerAccountId } : o,
          ),
        }),
      )
    }
    if (ledgerAccountId) {
      postBookingCharge({
        bookingId: created.id,
        ledgerAccountId,
        amount: created.price,
        passengerName: created.passengerName,
        seatNumber: created.seatNumber,
      })
      bumpLedger()
    }

    return created
  }

  const updateBooking: AppContextValue['updateBooking'] = (id, patch) => {
    const booking = state.bookings.find((b) => b.id === id)
    if (!booking) return 'الحجز غير موجود'

    if (patch.seatNumber !== undefined && patch.seatNumber !== booking.seatNumber) {
      const seats = getTripSeats(booking.tripId)
      if (seats.bookedSeats.filter((n) => n !== booking.seatNumber).includes(patch.seatNumber)) {
        return 'المقعد الجديد محجوز'
      }
    }

    setState((s) => {
      const nextBookings = s.bookings.map((b) => {
        if (b.id !== id) return b
        return { ...b, ...patch }
      })

      let nextVouchers = s.vouchers
      if (patch.status === 'cancelled' && booking.status === 'confirmed') {
        nextVouchers = [
          ...s.vouchers,
          {
            id: uid('vch'),
            officeId: booking.officeId,
            type: 'payment',
            amount: booking.price,
            description: `إلغاء حجز ${booking.passengerName}`,
            date: new Date().toISOString().slice(0, 10),
            relatedBookingId: booking.id,
          },
        ]
      }

      return persist({ ...s, bookings: nextBookings, vouchers: nextVouchers })
    })

    if (patch.status === 'cancelled' && booking.status === 'confirmed') {
      reverseBookingCharge(booking.id)
      bumpLedger()
    }

    return null
  }

  const addVoucher: AppContextValue['addVoucher'] = (voucher) => {
    setState((s) =>
      persist({
        ...s,
        vouchers: [...s.vouchers, { ...voucher, id: voucher.id ?? uid('vch') }],
      }),
    )
  }

  const value: AppContextValue = {
    state,
    currentUser,
    currentOffice,
    isAdmin,
    login,
    logout,
    resetData,
    getDestination,
    getBus,
    getDriver,
    getOffice,
    getTripLabel,
    getTripSeats,
    getOfficeAgencyBalance,
    upsertOffice,
    upsertUser,
    deleteUser,
    upsertBus,
    upsertDriver,
    upsertDestination,
    upsertTrip,
    cancelTrip,
    upsertCustomer,
    createBooking,
    updateBooking,
    addVoucher,
    can,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
