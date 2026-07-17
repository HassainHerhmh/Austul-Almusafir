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
  VisaType,
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
    phone: u.phone ?? '',
    role: u.role,
    officeId: u.officeId ?? null,
    driverId: u.driverId ?? null,
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
    ticketNumber: b.ticketNumber ?? '',
    passportNumber: b.passportNumber ?? '',
    visaTypeId: b.visaTypeId ?? '',
    boardingDestinationId: b.boardingDestinationId ?? '',
    arrivalDestinationId: b.arrivalDestinationId ?? '',
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

function asVisaType(v: any): VisaType {
  return {
    id: v.id,
    name: v.name,
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
    statement: (
      id: string,
      params?: { from?: string | null; to?: string | null; types?: string | null },
    ) => {
      const q = new URLSearchParams()
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      if (params?.types) q.set('types', params.types)
      const qs = q.toString()
      return apiRequest<{
        officeId: string
        officeName: string
        ledgerAccountId: number
        fromDate: string | null
        toDate: string | null
        openingBalance: number
        closingBalance: number
        list: Array<{
          id: number
          journal_date: string
          debit: number
          credit: number
          balance: number
          notes: string | null
          reference_type: string
          reference_id: number
          entry_label: string
        }>
      }>(`/api/offices/${id}/statement${qs ? `?${qs}` : ''}`)
    },
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

  visaTypes: {
    list: () => apiRequest<{ list: VisaType[] }>('/api/visa-types'),
    create: (data: unknown) =>
      apiRequest<{ visaType: VisaType }>('/api/visa-types', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiRequest<{ visaType: VisaType }>(`/api/visa-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/api/visa-types/${id}`, { method: 'DELETE' }),
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
    remove: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/api/drivers/${id}`, { method: 'DELETE' }),
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
    open: (id: string) =>
      apiRequest<{ trip: Trip }>(`/api/trips/${id}/open`, { method: 'POST' }),
    close: (id: string) =>
      apiRequest<{ trip: Trip }>(`/api/trips/${id}/close`, { method: 'POST' }),
    reopen: (id: string) =>
      apiRequest<{ trip: Trip }>(`/api/trips/${id}/reopen`, { method: 'POST' }),
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
    remove: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/api/bookings/${id}`, { method: 'DELETE' }),
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
    list: () => apiRequest<{ list: any[] }>('/api/accounts'),
    sub: () => apiRequest<{ list: any[] }>('/api/accounts/sub'),
    balance: (id: number, before?: string | null) => {
      const q = before ? `?before=${encodeURIComponent(before)}` : ''
      return apiRequest<{ balance: number; accountId: number }>(
        `/api/accounts/${id}/balance${q}`,
      )
    },
    childrenSummary: (
      parentId: number,
      params?: { from?: string | null; to?: string | null },
    ) => {
      const q = new URLSearchParams()
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      const qs = q.toString()
      return apiRequest<{
        parent: any
        from: string | null
        to: string | null
        list: Array<{
          id: number
          code: string
          name_ar: string
          account_level: string
          debit: number
          credit: number
          balance: number
        }>
        totals: { debit: number; credit: number; balance: number }
      }>(`/api/accounts/${parentId}/children-summary${qs ? `?${qs}` : ''}`)
    },
    create: (data: unknown) =>
      apiRequest<{ account: any }>('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      apiRequest<{ account: any }>(`/api/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    journalLines: (params?: {
      from?: string | null
      to?: string | null
      accountId?: number | null
      types?: string | null
    }) => {
      const q = new URLSearchParams()
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      if (params?.accountId) q.set('accountId', String(params.accountId))
      if (params?.types) q.set('types', params.types)
      const qs = q.toString()
      return apiRequest<{
        count: number
        list: Array<{
          id: number
          journal_date: string
          account_id: number
          account_code: string
          account_name: string
          debit: number
          credit: number
          currency_code?: string | null
          currency_name?: string | null
          notes: string | null
          reference_type: string
          reference_id: number
          entry_label: string
          created_at: string
        }>
      }>(`/api/accounts/journal-lines${qs ? `?${qs}` : ''}`)
    },
    createManualJournal: (data: {
      journal_date: string
      amount: number
      debit_account_id: number
      credit_account_id: number
      notes?: string
      reference_type?: 'manual_journal' | 'receipt' | 'payment'
      currency_code?: string | null
      currency_name?: string | null
    }) =>
      apiRequest<{ referenceId: number; referenceType?: string }>(
        '/api/accounts/journal-manual',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    updateManualJournal: (
      ref: number,
      data: {
        journal_date: string
        amount: number
        debit_account_id: number
        credit_account_id: number
        notes?: string
        reference_type?: 'manual_journal' | 'receipt' | 'payment'
        currency_code?: string | null
        currency_name?: string | null
      },
    ) =>
      apiRequest<{ referenceId: number; referenceType?: string }>(
        `/api/accounts/journal-manual/${ref}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      ),
    deleteManualJournal: (
      ref: number,
      type: 'manual_journal' | 'receipt' | 'payment' = 'manual_journal',
    ) =>
      apiRequest<{ deleted: number }>(
        `/api/accounts/journal-manual/${ref}?type=${encodeURIComponent(type)}`,
        {
          method: 'DELETE',
        },
      ),
  },

  settings: {
    transitAccounts: {
      get: () =>
        apiRequest<{
          data: {
            office_commissions_account: number | null
            ticket_revenue_account: number | null
          }
        }>('/api/settings/transit-accounts'),
      save: (data: {
        office_commissions_account?: number | null
        ticket_revenue_account?: number | null
      }) =>
        apiRequest<{
          data: {
            office_commissions_account: number | null
            ticket_revenue_account: number | null
          }
        }>('/api/settings/transit-accounts', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
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
    brand: {
      get: () =>
        apiRequest<{
          data: { name: string; logoUrl: string | null; phones: string }
        }>('/api/settings/brand'),
      save: (data: { name: string; logoUrl: string | null; phones: string }) =>
        apiRequest<{
          data: { name: string; logoUrl: string | null; phones: string }
        }>('/api/settings/brand', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
  },

  tracking: {
    myTrips: () =>
      apiRequest<{
        list: Array<{
          id: string
          date: string
          departureTime: string
          status: string
          price: number
          busNumber: string
          plateNumber: string
          label: string
          trackingActive: boolean
          lastLat: number | null
          lastLng: number | null
          lastUpdatedAt: string | null
        }>
      }>('/api/tracking/my-trips'),
    ping: (data: {
      tripId: string
      lat: number
      lng: number
      accuracy?: number | null
      speed?: number | null
      heading?: number | null
    }) =>
      apiRequest<{
        location: {
          tripId: string
          lat: number
          lng: number
          active: boolean
          updatedAt: string
        }
      }>('/api/tracking/ping', { method: 'POST', body: JSON.stringify(data) }),
    stop: (tripId: string) =>
      apiRequest<{ location?: { tripId: string; active: boolean; updatedAt: string }; stopped?: boolean }>(
        '/api/tracking/stop',
        { method: 'POST', body: JSON.stringify({ tripId }) },
      ),
    live: () =>
      apiRequest<{
        list: Array<{
          tripId: string
          lat: number
          lng: number
          accuracy: number | null
          speed: number | null
          heading: number | null
          active: boolean
          updatedAt: string
          trip: {
            id: string
            date: string
            departureTime: string
            status: string
            label: string
            busNumber: string
            plateNumber: string
            driverName: string
            driverPhone: string
          }
        }>
      }>('/api/tracking/live'),
  },
}

export { asOffice, asUser, asBooking, asDestination, asVisaType }
