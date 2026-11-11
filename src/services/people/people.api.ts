import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation, usePagedList } from '../request'
import type { Paged } from '../types'
import type { BookingRow, Note } from '../bookings/bookings.api'
import type { PayoutRow, WalletSummary } from '../money/money.api'

export interface UserRow {
  id: string
  firstName: string
  lastName: string
  email: string
  countryDialCode: string
  phoneNumber: string
  isActivated: boolean
  isBlocked: boolean
  isVerified: boolean
  suspendedAt: string | null
  createdAt: string
}

export interface TenantRow {
  id: string
  tenantType: 'fleet_partner' | 'independent_host'
  status: 'active' | 'suspended' | 'deactivated'
  isVerified: boolean
  suspendedAt: string | null
  createdAt: string
  name: string
  phone: string
  verificationStatus: string
  ownerEmail: string
  vehicleCount: number
}

const paged = <T,>(key: string, url: string, f: Record<string, unknown>) =>
  ({
    queryKey: [key, f],
    queryFn: ({ pageParam }: { pageParam: string }) => get<Paged<T>>(url, { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p: Paged<T>) => p.nextCursor || undefined,
  }) as const

export const useUsers = (f: { q?: string; verified?: string; suspended?: boolean }) => useInfiniteQuery(paged<UserRow>(QUERY_KEYS.USERS, API_ENDPOINTS.USERS, f))
export const useTenants = (f: { q?: string; type?: string; status?: string; verified?: string }) => useInfiniteQuery(paged<TenantRow>(QUERY_KEYS.TENANTS, API_ENDPOINTS.TENANTS, f))

export interface AccountDoc {
  id: string
  documentType: string
  status: string | null
  verificationMode: string | null
  rejectionReason: string | null
  nameMatched: boolean | null
  dobMatched: boolean | null
  documentUrl: string | null
  documentPurgedAt: string | null
  createdAt: string
}

export interface OpenBooking {
  id: string
  status: string
  startTime: string
  endTime: string
}

export interface UserProfile {
  user: UserRow & { gender: string | null; kycSubmittedAt: string | null; suspendReason: string | null; bookingCount: number; disputeCount: number; reviewCount: number }
  verifiedLegalName?: string
  documents: AccountDoc[]
  wallet?: WalletSummary
  recentBookings: BookingRow[]
  notes: Note[]
  openBookings: OpenBooking[]
}

export interface TenantProfile {
  tenant: TenantRow & {
    suspendReason: string | null
    commissionBps: number
    settlementBankName: string
    settlementAccountNumber: string
    settlementAccountName: string
    address: string
    bookingCount: number
  }
  verifiedLegalName?: string
  settlementNameMatches?: boolean
  documents: AccountDoc[]
  staff: { id: string; email: string; fullName: string; role: string | null; isActivated: boolean | null; isBlocked: boolean | null; lastLoginAt: string | null; disabledByPlatformAt: string | null }[]
  drivers: { id: string; fullName: string; verificationStatus: string; isActive: boolean }[]
  vehicles: { id: string; make: string; model: string; year: number; licensePlate: string; status: string; isBookable: boolean; takenDownAt: string | null }[]
  recentBookings: BookingRow[]
  payouts: PayoutRow[]
  notes: Note[]
  openBookings: OpenBooking[]
}

export const useUser = (id: string) => useQuery({ queryKey: [QUERY_KEYS.USER, id], queryFn: () => get<UserProfile>(API_ENDPOINTS.user(id)) })
export const useTenant = (id: string, reveal?: { reason: string }) =>
  useQuery({
    queryKey: [QUERY_KEYS.TENANT, id, reveal?.reason ?? ''],
    queryFn: () => get<TenantProfile>(API_ENDPOINTS.tenant(id), reveal ? { reveal: true, reason: reveal.reason } : undefined),
    gcTime: reveal ? 0 : undefined,
  })

const keys = [[QUERY_KEYS.USER], [QUERY_KEYS.TENANT], [QUERY_KEYS.USERS], [QUERY_KEYS.TENANTS], [QUERY_KEYS.APPROVALS]]

export type AccountKind = 'users' | 'tenants'

export const useAccountAction = () =>
  useAdminMutation((v: { kind: AccountKind; id: string; action: 'suspend' | 'reactivate' | 'revoke-sessions'; reason: string }) =>
    send('post', API_ENDPOINTS.accountAction(v.kind, v.id, v.action), { reason: v.reason }), { invalidate: keys })

export const useMessageAccount = () =>
  useAdminMutation((v: { kind: AccountKind; id: string; title: string; body: string }) => send('post', API_ENDPOINTS.accountAction(v.kind, v.id, 'message'), v), {
    success: 'Message sent',
  })

export const useProposeCommission = () =>
  useAdminMutation((v: { id: string; bps: number | null; reason: string }) => send('patch', API_ENDPOINTS.tenantCommission(v.id), { bps: v.bps, reason: v.reason }), {
    invalidate: [[QUERY_KEYS.APPROVALS]],
  })

export const useVendorStaffDisable = () =>
  useAdminMutation((v: { tenantId: string; staffId: string; disabled: boolean; reason: string }) =>
    send('post', API_ENDPOINTS.vendorStaffDisable(v.tenantId, v.staffId), v), { invalidate: [[QUERY_KEYS.TENANT]] })

export type WaitlistRow = { id: string; name: string; email: string; phoneNumber: string; businessType: string; numberOfCars: string; howDidYouHear: string; createdAt: string }
export const useWaitlist = () => usePagedList<WaitlistRow>([QUERY_KEYS.WAITLIST], API_ENDPOINTS.WAITLIST)

export const useInviteWaitlist = () =>
  useAdminMutation((id: string) => send('post', API_ENDPOINTS.waitlistInvite(id)), { invalidate: [[QUERY_KEYS.WAITLIST]] })

export const useSettlementDecision = () =>
  useAdminMutation((v: { id: string; accept: boolean; reason: string }) => send('post', API_ENDPOINTS.settlementDecision(v.id), v), {
    invalidate: [[QUERY_KEYS.TENANT]],
  })
