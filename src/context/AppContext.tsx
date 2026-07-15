import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, getToken, setToken } from '../api/client'
import { asBooking, asOffice, asUser, serverApi } from '../api/serverApi'
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
  loading: boolean
  apiReady: boolean
  currentUser: User | null
  currentOffice: Office | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  refreshAll: () => Promise<void>
  resetData: () => void
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
  getOfficeAgencyBalance: (officeId?: string) => number
  upsertOffice: (office: Omit<Office, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  upsertUser: (user: Omit<User, 'id'> & { id?: string }) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  upsertBus: (bus: Omit<Bus, 'id'> & { id?: string }) => Promise<void>
  upsertDriver: (driver: Omit<Driver, 'id'> & { id?: string }) => Promise<void>
  upsertDestination: (dest: Omit<Destination, 'id'> & { id?: string }) => Promise<void>
  upsertTrip: (trip: Omit<Trip, 'id'> & { id?: string }) => Promise<void>
  cancelTrip: (id: string) => Promise<void>
  upsertCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => Promise<Customer>
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
  }) => Promise<Booking | string>
  updateBooking: (
    id: string,
    patch: Partial<
      Pick<
        Booking,
        'passengerName' | 'passportNumber' | 'seatNumber' | 'status' | 'paymentMethod' | 'notes'
      >
    >,
  ) => Promise<string | null>
  addVoucher: (voucher: Omit<Voucher, 'id'> & { id?: string }) => Promise<void>
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

const emptyState = (currentUserId: string | null = null): AppState => ({
  currentUserId,
  offices: [],
  users: [],
  destinations: [],
  buses: [],
  drivers: [],
  trips: [],
  customers: [],
  bookings: [],
  vouchers: [],
})

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState())
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [apiReady, setApiReady] = useState(false)

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

  const refreshBalances = async (offices: Office[]) => {
    const next: Record<string, number> = {}
    await Promise.all(
      offices.map(async (o) => {
        try {
          const res = await serverApi.offices.balance(o.id)
          next[o.id] = res.balance
        } catch {
          next[o.id] = 0
        }
      }),
    )
    setBalances(next)
  }

  const refreshAll = useCallback(async () => {
    if (!getToken()) {
      setState(emptyState())
      setBalances({})
      setApiReady(false)
      return
    }

    const [
      me,
      offices,
      users,
      destinations,
      buses,
      drivers,
      trips,
      bookings,
      customers,
      vouchers,
    ] = await Promise.all([
      serverApi.me(),
      serverApi.offices.list(),
      serverApi.users.list(),
      serverApi.destinations.list(),
      serverApi.buses.list(),
      serverApi.drivers.list(),
      serverApi.trips.list(),
      serverApi.bookings.list(),
      serverApi.customers.list(),
      serverApi.vouchers.list(),
    ])

    const officeList = (offices.list ?? []).map(asOffice)
    const userList = (users.list ?? []).map(asUser)
    const meUser = asUser(me.user)
    if (!userList.find((u) => u.id === meUser.id)) userList.unshift(meUser)

    setState({
      currentUserId: meUser.id,
      offices: officeList,
      users: userList,
      destinations: destinations.list ?? [],
      buses: buses.list ?? [],
      drivers: drivers.list ?? [],
      trips: trips.list ?? [],
      customers: customers.list ?? [],
      bookings: (bookings.list ?? []).map(asBooking),
      vouchers: vouchers.list ?? [],
    })
    setApiReady(true)
    await refreshBalances(officeList)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (getToken()) await refreshAll()
      } catch {
        setToken(null)
        if (!cancelled) {
          setState(emptyState())
          setApiReady(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshAll])

  const login = async (username: string, password: string) => {
    try {
      const res = await serverApi.login(username, password)
      setToken(res.token)
      setLoading(true)
      await refreshAll()
      setLoading(false)
      return null
    } catch (e) {
      setLoading(false)
      return e instanceof ApiError ? e.message : 'تعذر تسجيل الدخول'
    }
  }

  const logout = () => {
    setToken(null)
    setState(emptyState())
    setBalances({})
    setApiReady(false)
  }

  const resetData = () => {
    alert('البيانات على السيرفر — لا يمكن إعادة التعيين من الواجهة.')
  }

  const getDestination = (id: string) => state.destinations.find((d) => d.id === id)
  const getBus = (id: string) => state.buses.find((b) => b.id === id)
  const getDriver = (id: string) => state.drivers.find((d) => d.id === id)
  const getOffice = (id: string) => state.offices.find((o) => o.id === id)

  const getOfficeAgencyBalance = (officeId?: string) => {
    const id = officeId ?? currentOffice?.id
    if (!id) return 0
    return balances[id] ?? 0
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

  const upsertOffice: AppContextValue['upsertOffice'] = async (office) => {
    if (office.id) {
      await serverApi.offices.update(office.id, office)
    } else {
      await serverApi.offices.create(office)
    }
    await refreshAll()
  }

  const upsertUser: AppContextValue['upsertUser'] = async (user) => {
    if (user.id) {
      const payload: Record<string, unknown> = {
        username: user.username,
        name: user.name,
        role: user.role,
        officeId: user.officeId,
        active: user.active,
      }
      if (user.password) payload.password = user.password
      await serverApi.users.update(user.id, payload)
    } else {
      await serverApi.users.create({
        username: user.username,
        password: user.password,
        name: user.name,
        role: user.role,
        officeId: user.officeId,
        active: user.active,
      })
    }
    await refreshAll()
  }

  const deleteUser = async (id: string) => {
    await serverApi.users.remove(id)
    await refreshAll()
  }

  const upsertBus: AppContextValue['upsertBus'] = async (bus) => {
    if (bus.id) await serverApi.buses.update(bus.id, bus)
    else await serverApi.buses.create(bus)
    await refreshAll()
  }

  const upsertDriver: AppContextValue['upsertDriver'] = async (driver) => {
    if (driver.id) await serverApi.drivers.update(driver.id, driver)
    else await serverApi.drivers.create(driver)
    await refreshAll()
  }

  const upsertDestination: AppContextValue['upsertDestination'] = async (dest) => {
    if (dest.id) await serverApi.destinations.update(dest.id, { name: dest.name })
    else await serverApi.destinations.create({ name: dest.name })
    await refreshAll()
  }

  const upsertTrip: AppContextValue['upsertTrip'] = async (trip) => {
    const payload = {
      busId: trip.busId,
      driverId: trip.driverId,
      assistantDriverId: trip.assistantDriverId,
      date: trip.date,
      departureTime: trip.departureTime,
      price: trip.price,
      status: trip.status,
      stops: trip.stops,
    }
    if (trip.id) await serverApi.trips.update(trip.id, payload)
    else await serverApi.trips.create(payload)
    await refreshAll()
  }

  const cancelTrip = async (id: string) => {
    await serverApi.trips.cancel(id)
    await refreshAll()
  }

  const upsertCustomer: AppContextValue['upsertCustomer'] = async (customer) => {
    if (customer.id) {
      // لا يوجد update customers في الـ API حالياً — نعيد العميل المحلي بعد refresh
      await refreshAll()
      return state.customers.find((c) => c.id === customer.id) ?? { ...customer, id: customer.id }
    }
    const res = await serverApi.customers.create(customer)
    await refreshAll()
    return res.customer
  }

  const createBooking: AppContextValue['createBooking'] = async (input) => {
    try {
      const res = await serverApi.bookings.create({
        tripId: input.tripId,
        officeId: input.officeId,
        passengerName: input.passengerName,
        phone: input.phone,
        nationalId: input.nationalId,
        passportNumber: input.passportNumber,
        seatNumber: input.seatNumber,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      })
      await refreshAll()
      return asBooking(res.booking)
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل إنشاء الحجز'
    }
  }

  const updateBooking: AppContextValue['updateBooking'] = async (id, patch) => {
    try {
      await serverApi.bookings.patch(id, patch)
      await refreshAll()
      return null
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل تحديث الحجز'
    }
  }

  const addVoucher: AppContextValue['addVoucher'] = async (voucher) => {
    await serverApi.vouchers.create({
      officeId: voucher.officeId,
      type: voucher.type,
      amount: voucher.amount,
      description: voucher.description,
      date: voucher.date,
      relatedBookingId: voucher.relatedBookingId,
    })
    await refreshAll()
  }

  const value: AppContextValue = {
    state,
    loading,
    apiReady,
    currentUser,
    currentOffice,
    isAdmin,
    login,
    logout,
    refreshAll,
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
