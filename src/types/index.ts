export type Role = 'admin' | 'office_manager' | 'booking_clerk' | 'accountant'

export type OfficeStatus = 'active' | 'suspended'
export type SubscriptionStatus = 'active' | 'expired' | 'trial'
export type BusStatus = 'available' | 'maintenance' | 'inactive'
export type TripStatus = 'scheduled' | 'departed' | 'cancelled' | 'completed'
export type BookingStatus = 'confirmed' | 'cancelled' | 'refunded'
export type PaymentMethod = 'cash' | 'transfer' | 'credit'
export type VoucherType = 'receipt' | 'payment'

export interface Office {
  id: string
  name: string
  city: string
  phone: string
  status: OfficeStatus
  subscription: SubscriptionStatus
  createdAt: string
  /** حساب ذمم المكتب في النظام المحاسبي */
  ledgerAccountId: number | null
}

export interface User {
  id: string
  username: string
  password: string
  name: string
  role: Role
  officeId: string | null
  active: boolean
}

export interface Destination {
  id: string
  name: string
}

export interface Bus {
  id: string
  plateNumber: string
  type: string
  seats: number
  status: BusStatus
}

export type DriverRole = 'primary' | 'assistant'

export interface Driver {
  id: string
  name: string
  phone: string
  licenseNumber: string
  role: DriverRole
  active: boolean
}

export interface TripStop {
  destinationId: string
  /** نقطة الركوب/النزول في هذه المحطة */
  point: string
}

export interface Trip {
  id: string
  busId: string
  driverId: string
  /** السائق المعاون (اختياري) */
  assistantDriverId: string | null
  date: string
  departureTime: string
  price: number
  status: TripStatus
  /** محطات متسلسلة: عدن ← عتق ← شرورة ← مكة */
  stops: TripStop[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  nationalId: string
  passportNumber: string
  officeId: string
}

export interface Booking {
  id: string
  tripId: string
  officeId: string
  customerId: string
  passengerName: string
  passportNumber: string
  seatNumber: number
  price: number
  paymentMethod: PaymentMethod
  notes: string
  status: BookingStatus
  bookedAt: string
  bookedBy: string
}

export interface Voucher {
  id: string
  officeId: string
  type: VoucherType
  amount: number
  description: string
  date: string
  relatedBookingId?: string
}

export interface AppState {
  offices: Office[]
  users: User[]
  destinations: Destination[]
  buses: Bus[]
  drivers: Driver[]
  trips: Trip[]
  customers: Customer[]
  bookings: Booking[]
  vouchers: Voucher[]
  currentUserId: string | null
}
