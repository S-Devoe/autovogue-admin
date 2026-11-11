import { useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from './api-endpoints'
import { QUERY_KEYS } from './query.keys'
import { get } from './request'

// Counts for the stat cards above the admin lists. Each key sits under its
// list's key, so anything that refreshes the list refreshes its counts.
// The API caches them in Redis and clears them on every write.
const stats = <T,>(key: string, endpoint: string) => () =>
  useQuery({ queryKey: [key, 'stats'], queryFn: () => get<T>(`${endpoint}/stats`), staleTime: 30_000 })

export interface UserStats { total: number; verified: number; notVerified: number; suspended: number; newThisWeek: number }
export interface TenantStats { total: number; fleetPartners: number; individualHosts: number; verified: number; notVerified: number; active: number; suspended: number }
export interface BookingStats {
  total: number
  pendingPayment: number
  pendingApproval: number
  confirmed: number
  active: number
  completed: number
  cancelled: number
  disputed: number
  paymentFailed: number
  overdue: number
}
export interface DisputeStats { open: number; unassigned: number; pastSla: number; resolved: number }
export interface PayoutStats { total: number; due: number; failed: number; held: number; releasing: number; released: number }

export const useUserStats = stats<UserStats>(QUERY_KEYS.USERS, API_ENDPOINTS.USERS)
export const useTenantStats = stats<TenantStats>(QUERY_KEYS.TENANTS, API_ENDPOINTS.TENANTS)
export const useBookingStats = stats<BookingStats>(QUERY_KEYS.BOOKINGS, API_ENDPOINTS.BOOKINGS)
export const useDisputeStats = stats<DisputeStats>(QUERY_KEYS.DISPUTES, API_ENDPOINTS.DISPUTES)
export const usePayoutStats = stats<PayoutStats>(QUERY_KEYS.PAYOUTS, API_ENDPOINTS.PAYOUTS)
