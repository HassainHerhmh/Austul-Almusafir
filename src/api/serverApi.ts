import { apiRequest } from './client'
import type {
  Booking,
  Bus,
  Customer,
  Destination,
  Driver,
  Office,
  Trip,
  User,
  Voucher,
} from '../types'

function asOffice(o: any): Office {
  return {
    id: o.id,
    name: o.name,
    city: o.city,
    phone: o.phone,
    status: o.status,
    subscription: o.subscription,
    ledgerAccountId: o.ledgerAccountId ?? null,
    commissionPercent: Number(o.commissionPercent) || 0,
    createdAt: String(o.createdAt).slice(0, 10),
  }
}

function asUser(u: any): User {
  return {
    id: u.id,
    username: u.username,
    password: '',
    name: u.name,
    role: u.role,
    officeId: u.officeId ?? null,
    active: !!u.active,
    permissions: u.permissions ?? null,
  }
}

function asBooking(b: any): Booking {
  return {
    id: b.id,
    tripId: b.tripId,
    officeId: b.officeId,
    customerId: b.customerId,
    passengerName: b.passengerName,
    passportNumber: b.passportNumber ?? '',
    boardingDestinationId: b.boardingDestinationId ?? '',
    seatNumber: b.seatNumber,
    price: b.price,
    paymentMethod: b.paymentMethod,
    notes: b.notes ?? '',
    status: b.status,
    bookedAt: typeof b.bookedAt === 'string' ? b.bookedAt : new Date(b.bookedAt).toISOString(),
    bookedBy: b.bookedBy ?? b.bookedById,
  }
}

function asDestination(d: any): Destination {
  return {
    id: d.id,
    name: d.name,
    ticketPrice: Number(d.ticketPrice) || 0,
  }
}

export const serverApi = {
  login: (username: string, password: string) =>
    apiRequest<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => apiRequest<{ user: any }>('/api/auth/me'),

  offices: {
    list: () => apiRequest<{ list: any[] }>('/api/offices'),
    create: (data: unknown) =>
      apiRequest<{ office: any }>('/api/offices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiRequest<{ office: any }>(`/api/offices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    balance: (id: string) =>
      apiRequest<{ balance: number; officeId: string }>(`/api/offices/${id}/balance`),
  },

  users: {
    list: () => apiRequest<{ list: any[] }>('/api/users'),
    create: (data: unknown) =>
      apiRequest<{ user: any }>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiRequest<{ user: any }>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
    getPermissions: (id: string) =>
      apiRequest<{ permissions: Record<string, any> | null }>(`/api/users/${id}/permissions`),
    savePermissions: (id: string, permissions: Record<string, any>) =>
      apiRequest<{ user: any }>(`/api/users/${id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      }),
  },

  destinations: {
    list: () => apiRequest<{ list: Destination[] }>('/api/destinations'),
    create: (data: unknown) =>
      apiRequest<{ destination: Destination }>('/api/destinations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiRequest<{ destination: Destination }>(`/api/destinations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/api/destinations/${id}`, { method: 'DELETE' }),
  },

  buses: {
    list: () => apiRequest<{ list: Bus[] }>('/api/buses'),
    create: (data: unknown) =>
      apiRequest<{ bus: Bus }>('/api/buses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiRequest<{ bus: Bus }>(`/api/buses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  drivers: {
    list: () => apiRequest<{ list: Driver[] }>('/api/drivers'),
    create: (data: unknown) =>
      apiRequest<{ driver: Driver }>('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiRequest<{ driver: Driver }>(`/api/drivers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  trips: {
    list: () => apiRequest<{ list: Trip[] }>('/api/trips'),
    create: (data: unknown) =>
      apiRequest<{ trip: Trip }>('/api/trips', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiRequest<{ trip: Trip }>(`/api/trips/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    cancel: (id: string) =>
      apiRequest<{ trip: Trip }>(`/api/trips/${id}/cancel`, { method: 'POST' }),
  },

  bookings: {
    list: () => apiRequest<{ list: any[] }>('/api/bookings'),
    create: (data: unknown) =>
      apiRequest<{ booking: any }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    patch: (id: string, data: unknown) =>
      apiRequest<{ booking: any }>(`/api/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  customers: {
    list: () => apiRequest<{ list: Customer[] }>('/api/customers'),
    create: (data: unknown) =>
      apiRequest<{ customer: Customer }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  vouchers: {
    list: () => apiRequest<{ list: Voucher[] }>('/api/vouchers'),
    create: (data: unknown) =>
      apiRequest<{ voucher: Voucher }>('/api/vouchers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  accounts: {
    sub: () => apiRequest<{ list: any[] }>('/api/accounts/sub'),
  },

  settings: {
    transitAccounts: {
      get: () =>
        apiRequest<{ data: { office_commissions_account: number | null } }>(
          '/api/settings/transit-accounts',
        ),
      save: (data: { office_commissions_account: number | null }) =>
        apiRequest<{ data: { office_commissions_account: number | null } }>(
          '/api/settings/transit-accounts',
          { method: 'POST', body: JSON.stringify(data) },
        ),
    },
    pricing: {
      get: () =>
        apiRequest<{ data: { mode: 'trip' | 'boarding' } }>('/api/settings/pricing'),
      save: (data: { mode: 'trip' | 'boarding' }) =>
        apiRequest<{ data: { mode: 'trip' | 'boarding' } }>('/api/settings/pricing', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
  },
}

export { asOffice, asUser, asBooking, asDestination }
