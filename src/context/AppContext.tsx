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
import { asBooking, asDestination, asOffice, asUser, serverApi } from '../api/serverApi'
import {
  LEGACY_ACTION_TO_PAGE,
  normalizePermissions,
  resolveUserPermissions,
  type PageAction,
} from '../data/permissions'
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
import { normalizeTrip } from '../utils/trip'

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
  upsertBus: (bus: Omit<Bus, 'id'> & { id?: string }) => Promise<Bus>
  upsertDriver: (driver: Omit<Driver, 'id'> & { id?: string }) => Promise<Driver>
  deleteDriver: (id: string) => Promise<void>
  upsertDestination: (dest: Omit<Destination, 'id'> & { id?: string }) => Promise<void>
  upsertTrip: (trip: Omit<Trip, 'id'> & { id?: string }) => Promise<void>
  cancelTrip: (id: string) => Promise<void>
  openTrip: (id: string) => Promise<void>
  closeTrip: (id: string) => Promise<void>
  reopenTrip: (id: string) => Promise<void>
  upsertCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => Promise<Customer>
  createBooking: (input: {
    tripId: string
    officeId: string
    passengerName: string
    phone: string
    passportNumber: string
    boardingDestinationId: string
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
  canPage: (pageId: string, action?: PageAction) => boolean
  saveUserPermissions: (
    userId: string,
    permissions: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }>,
  ) => Promise<string | null>
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

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [item, ...list]
  const next = list.slice()
  next[idx] = item
  return next
}

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

  const resolvedPermissions = useMemo(() => {
    if (!currentUser) return null
    if (currentUser.role === 'admin') return resolveUserPermissions('admin', null)
    const saved = normalizePermissions(currentUser.permissions, currentUser.role)
    return resolveUserPermissions(currentUser.role, saved)
  }, [currentUser])

  const canPage = useCallback(
    (pageId: string, action: PageAction = 'view') => {
      if (!currentUser) return false
      if (currentUser.role === 'admin') return true
      if (!resolvedPermissions) return false
      return !!resolvedPermissions[pageId]?.[action]
    },
    [currentUser, resolvedPermissions],
  )

  const can = useCallback(
    (action: Permission) => {
      if (!currentUser) return false
      if (!ROLE_PERMS[currentUser.role].includes(action)) return false
      if (currentUser.role === 'admin') return true
      const mapped = LEGACY_ACTION_TO_PAGE[action]
      if (!mapped || !resolvedPermissions) return true
      // إذا وُجدت صلاحيات محفوظة للمستخدم طبّق تقييد الصفحة
      if (currentUser.permissions && Object.keys(currentUser.permissions).length > 0) {
        return !!resolvedPermissions[mapped.page]?.[mapped.action]
      }
      return true
    },
    [currentUser, resolvedPermissions],
  )

  const refreshBalances = useCallback(async (offices: Office[], onlyOfficeId?: string | null) => {
    const targets = onlyOfficeId
      ? [{ id: onlyOfficeId } as Office]
      : offices
    if (!targets.length) return

    const next: Record<string, number> = {}
    await Promise.all(
      targets.map(async (o) => {
        try {
          const res = await serverApi.offices.balance(o.id)
          next[o.id] = res.balance
        } catch {
          next[o.id] = 0
        }
      }),
    )
    setBalances((prev) => ({ ...prev, ...next }))
  }, [])

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
      destinations: (destinations.list ?? []).map(asDestination),
      buses: (buses.list ?? []).map((b: any) => ({
        ...b,
        busNumber: b.busNumber ?? '',
        year: b.year ?? '',
      })),
      drivers: (drivers.list ?? []).map((d: any) => ({
        ...d,
        nationality: d.nationality ?? '',
        licenseNumber: d.licenseNumber ?? '',
      })),
      trips: (trips.list ?? []).map((t) =>
        normalizeTrip(t as Parameters<typeof normalizeTrip>[0]),
      ),
      customers: customers.list ?? [],
      bookings: (bookings.list ?? []).map(asBooking),
      vouchers: vouchers.list ?? [],
    })
    setApiReady(true)
    // الأرصدة في الخلفية — لا تحجب الواجهة
    const balanceScope = meUser.role === 'admin' ? undefined : meUser.officeId
    void refreshBalances(officeList, balanceScope)
  }, [refreshBalances])

  const saveUserPermissions = async (
    userId: string,
    permissions: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }>,
  ) => {
    try {
      const res = await serverApi.users.savePermissions(userId, permissions)
      const user = asUser(res.user)
      setState((s) => ({ ...s, users: upsertById(s.users, user) }))
      return null
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل حفظ الصلاحيات'
    }
  }

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
    const res = office.id
      ? await serverApi.offices.update(office.id, office)
      : await serverApi.offices.create(office)
    const saved = asOffice(res.office)
    setState((s) => ({ ...s, offices: upsertById(s.offices, saved) }))
  }

  const upsertUser: AppContextValue['upsertUser'] = async (user) => {
    let saved: User
    if (user.id) {
      const payload: Record<string, unknown> = {
        username: user.username,
        name: user.name,
        role: user.role,
        officeId: user.officeId,
        active: user.active,
      }
      if (user.password) payload.password = user.password
      const res = await serverApi.users.update(user.id, payload)
      saved = asUser(res.user)
    } else {
      const res = await serverApi.users.create({
        username: user.username,
        password: user.password,
        name: user.name,
        role: user.role,
        officeId: user.officeId,
        active: user.active,
      })
      saved = asUser(res.user)
    }
    setState((s) => ({ ...s, users: upsertById(s.users, saved) }))
  }

  const deleteUser = async (id: string) => {
    await serverApi.users.remove(id)
    setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }))
  }

  const upsertBus: AppContextValue['upsertBus'] = async (bus) => {
    const res = bus.id
      ? await serverApi.buses.update(bus.id, bus)
      : await serverApi.buses.create(bus)
    setState((s) => ({ ...s, buses: upsertById(s.buses, res.bus) }))
    return res.bus
  }

  const upsertDriver: AppContextValue['upsertDriver'] = async (driver) => {
    const res = driver.id
      ? await serverApi.drivers.update(driver.id, driver)
      : await serverApi.drivers.create(driver)
    setState((s) => ({ ...s, drivers: upsertById(s.drivers, res.driver) }))
    return res.driver
  }

  const deleteDriver = async (id: string) => {
    await serverApi.drivers.remove(id)
    setState((s) => ({ ...s, drivers: s.drivers.filter((d) => d.id !== id) }))
  }

  const upsertDestination: AppContextValue['upsertDestination'] = async (dest) => {
    const payload = { name: dest.name, ticketPrice: dest.ticketPrice ?? 0 }
    const res = dest.id
      ? await serverApi.destinations.update(dest.id, payload)
      : await serverApi.destinations.create(payload)
    setState((s) => ({
      ...s,
      destinations: upsertById(s.destinations, asDestination(res.destination)),
    }))
  }

  const upsertTrip: AppContextValue['upsertTrip'] = async (trip) => {
    const payload = {
      busId: trip.busId,
      driverId: trip.driverId,
      assistantName: trip.assistantName ?? '',
      assistantPhone: trip.assistantPhone ?? '',
      pricingMode: trip.pricingMode === 'boarding' ? 'boarding' : 'trip',
      date: trip.date,
      departureTime: trip.departureTime,
      price: trip.price,
      status: trip.status,
      stops: trip.stops,
    }
    const res = trip.id
      ? await serverApi.trips.update(trip.id, payload)
      : await serverApi.trips.create(payload)
    setState((s) => ({ ...s, trips: upsertById(s.trips, res.trip) }))
  }

  const cancelTrip = async (id: string) => {
    const res = await serverApi.trips.cancel(id)
    setState((s) => ({ ...s, trips: upsertById(s.trips, res.trip) }))
  }

  const openTrip = async (id: string) => {
    const res = await serverApi.trips.open(id)
    setState((s) => ({ ...s, trips: upsertById(s.trips, res.trip) }))
  }

  const closeTrip = async (id: string) => {
    const res = await serverApi.trips.close(id)
    setState((s) => ({ ...s, trips: upsertById(s.trips, res.trip) }))
  }

  const reopenTrip = async (id: string) => {
    const res = await serverApi.trips.reopen(id)
    setState((s) => ({ ...s, trips: upsertById(s.trips, res.trip) }))
  }

  const upsertCustomer: AppContextValue['upsertCustomer'] = async (customer) => {
    if (customer.id) {
      return state.customers.find((c) => c.id === customer.id) ?? { ...customer, id: customer.id }
    }
    const res = await serverApi.customers.create(customer)
    setState((s) => ({ ...s, customers: upsertById(s.customers, res.customer) }))
    return res.customer
  }

  const createBooking: AppContextValue['createBooking'] = async (input) => {
    try {
      const res = await serverApi.bookings.create({
        tripId: input.tripId,
        officeId: input.officeId,
        passengerName: input.passengerName,
        phone: input.phone,
        passportNumber: input.passportNumber,
        boardingDestinationId: input.boardingDestinationId,
        seatNumber: input.seatNumber,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      })
      const booking = asBooking(res.booking)
      setState((s) => ({
        ...s,
        bookings: upsertById(s.bookings, booking),
      }))
      void refreshBalances(state.offices, input.officeId)
      return booking
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل إنشاء الحجز'
    }
  }

  const updateBooking: AppContextValue['updateBooking'] = async (id, patch) => {
    try {
      const res = await serverApi.bookings.patch(id, patch)
      const booking = asBooking(res.booking)
      setState((s) => ({ ...s, bookings: upsertById(s.bookings, booking) }))
      if (patch.status === 'cancelled') {
        void refreshBalances(state.offices, booking.officeId)
      }
      return null
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل تحديث الحجز'
    }
  }

  const addVoucher: AppContextValue['addVoucher'] = async (voucher) => {
    const res = await serverApi.vouchers.create({
      officeId: voucher.officeId,
      type: voucher.type,
      amount: voucher.amount,
      description: voucher.description,
      date: voucher.date,
      relatedBookingId: voucher.relatedBookingId,
    })
    setState((s) => ({ ...s, vouchers: upsertById(s.vouchers, res.voucher) }))
    void refreshBalances(state.offices, voucher.officeId)
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
    deleteDriver,
    upsertDestination,
    upsertTrip,
    cancelTrip,
    openTrip,
    closeTrip,
    reopenTrip,
    upsertCustomer,
    createBooking,
    updateBooking,
    addVoucher,
    can,
    canPage,
    saveUserPermissions,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
