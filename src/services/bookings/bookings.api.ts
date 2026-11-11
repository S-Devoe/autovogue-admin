import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'
import type { Paged } from '../types'

export const BOOKING_STATUSES = ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'PAYMENT_FAILED'] as const
export const FUND_STATES = ['PENDING', 'HELD', 'HELD_DISPUTED', 'RELEASING', 'RELEASED', 'PARTIALLY_RELEASED', 'REFUNDED', 'EXPIRED', 'FAILED'] as const

export interface BookingRow {
  id: string
  status: string
  fundState: string
  startTime: string
  endTime: string
  createdAt: string
  totalInvoiceKobo: number | null
  vendorPayoutKobo: number | null
  paymentGateway: string
  invoiceExpiresAt: string | null
  payoutHeldAt: string | null
  disputeStatus: string | null
  serviceType: string
  customerId: string
  customerName: string
  customerEmail: string
  tenantId: string
  vendorName: string
  vehicleId: string
  vehicleName: string
  licensePlate: string
}

export interface BookingFilters {
  q?: string
  status?: string
  fundState?: string
  from?: string
  to?: string
  tenantId?: string
  customerId?: string
}

export const useBookings = (f: BookingFilters) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.BOOKINGS, f],
    queryFn: ({ pageParam }) => get<Paged<BookingRow>>(API_ENDPOINTS.BOOKINGS, { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export interface TimelineItem {
  at: string
  source: 'event' | 'payment' | 'payment_check'
  type: string
  actorId?: string
  actorType?: string
  amountKobo?: number
  fundState?: string
  detail?: string
}

export interface Note {
  id: string
  body: string
  authorName: string
  createdAt: string
}

/** Extra days/hours a user bought on an ongoing trip (no caution fee). */
export interface BookingExtension {
  id: string
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED'
  units: number
  unit: 'day' | 'hour'
  oldEndTime: string
  newEndTime: string
  rental: number
  chauffeurFee: number
  serviceFee: number
  vat: number
  total: number
  vendorCommission: number
  vendorVat: number
  vendorShare: number
  paidWith?: string
  createdAt: string
  paidAt?: string
  expiresAt?: string
  releasedAt?: string
}

export interface BookingDetail {
  booking: Record<string, any> & BookingRow & {
    customerPhone: string
    tenantType: string
    vehicleYear: number
    baseAmountKobo: number
    fuelAmountKobo: number
    cautionFeeKobo: number
    totalCommissionKobo: number | null
    autovogueNetKobo: number | null
    gatewayReference: string | null
    payoutEligibleAt: string | null
    payoutReleasedAt: string | null
    payoutHoldReason: string | null
    pickupOdometerKm: number | null
    returnOdometerKm: number | null
    startFuelPhotoUrl: string | null
    endFuelPhotoUrl: string | null
    pickupConfirmedAt: string | null
    pickupConfirmedBy: 'user' | 'auto' | 'admin' | 'return' | null
    returnReportedAt: string | null
  }
  timeline: TimelineItem[]
  /** Extra time bought on the trip, every attempt. Money is in naira. */
  extensions?: BookingExtension[]
  paymentChecks: number
  refundedKobo: number
  refundableKobo: number
  notes: Note[]
}

export const useBooking = (id: string) =>
  useQuery({ queryKey: [QUERY_KEYS.BOOKING, id], queryFn: () => get<BookingDetail>(API_ENDPOINTS.booking(id)) })

const inv = [[QUERY_KEYS.BOOKING], [QUERY_KEYS.BOOKINGS], [QUERY_KEYS.ATTENTION], [QUERY_KEYS.PAYOUTS]]

export const useRecheckPayment = () => useAdminMutation((id: string) => send('post', API_ENDPOINTS.recheckPayment(id)), { invalidate: inv })

export const useCancelBooking = () =>
  useAdminMutation(
    (v: { id: string; reason: string; refund: 'policy' | 'none' | 'full' | 'partial'; refundKobo?: number; cancelledFor: string }) =>
      send('post', API_ENDPOINTS.cancelBooking(v.id), v),
    { invalidate: inv },
  )

/** Staff confirm the user received the car (they forgot to in the app); releases a held vendor share. */
export const useConfirmPickup = () =>
  useAdminMutation((v: { id: string; reason: string }) => send('post', API_ENDPOINTS.confirmPickup(v.id), { reason: v.reason }), {
    invalidate: inv,
    success: 'Receipt confirmed for the user',
  })

export const useAddNote = (url: (id: string) => string, keys: string[]) =>
  useAdminMutation((v: { id: string; body: string }) => send('post', url(v.id), { body: v.body }), {
    invalidate: keys.map((k) => [k]),
    success: 'Note added',
  })

export interface RefundQuote {
  amountKobo: number
  feeKobo: number
  netKobo: number
}

/** What the user actually gets: the amount less the Paystack fee users bear. */
export const useRefundQuote = (id: string, amountKobo: number, enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.REFUND_QUOTE, id, amountKobo],
    queryFn: () => get<RefundQuote>(API_ENDPOINTS.refundQuote(id), { amountKobo }),
    enabled: enabled && amountKobo > 0,
  })

export interface CancellationQuote {
  tier: 'full' | 'partial' | 'late'
  pct: number
  hoursBeforePickup: number
  amountKobo: number
  feeKobo: number
  netKobo: number
  cautionKobo: number
}

/** What the cancellation policy refunds if cancelled now. */
export const useCancellationQuote = (id: string, enabled: boolean) =>
  useQuery({ queryKey: [QUERY_KEYS.CANCEL_QUOTE, id], queryFn: () => get<CancellationQuote>(API_ENDPOINTS.cancellationQuote(id)), enabled })
