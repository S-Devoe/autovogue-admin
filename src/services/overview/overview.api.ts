import { useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get } from '../request'

export interface AttentionItem {
  key: string
  label: string
  count: number
  severity: 'info' | 'warning' | 'danger'
  link: string
  oldest?: string
}

export interface Attention {
  items: AttentionItem[]
  badges: Record<string, number>
  lastReconciliationAt?: string
}

export interface Metrics {
  bookingsCreated: number
  bookingsPaid: number
  bookingsCancelled: number
  grossValueKobo: number
  commissionKobo: number
  payoutsKobo: number
  refundsKobo: number
  newRenters: number
  newVendors: number
  verificationsApproved: number
  verificationsRejected: number
}

export interface Health {
  rabbitmq: boolean
  redis: boolean
  storage: boolean
  push: boolean
  staffTwoFactor: boolean
  paymentChecksPending: number
  kycChecksPending: number
  lastReconciliationAt?: string
  environment: string
  deadLetters: Record<string, number>
  documentRetentionDays: number
  alertsToSlack: boolean
  retention: { idImageDays: number; purgeEveryHours: number; purgerRunning: boolean; pendingIdMaxHours: number; auditLogMinYears: number }
}

/** Work queue + sidebar badges; refreshed every 10 s (PRD: live within 10 s). */
export const useAttention = () =>
  useQuery({ queryKey: [QUERY_KEYS.ATTENTION], queryFn: () => get<Attention>(API_ENDPOINTS.ATTENTION), refetchInterval: 10_000 })

export const useMetrics = (range: 'today' | '7d' | '30d', enabled = true) =>
  useQuery({ queryKey: [QUERY_KEYS.METRICS, range], queryFn: () => get<Metrics>(API_ENDPOINTS.METRICS, { range }), enabled })

export const useHealth = () =>
  useQuery({ queryKey: [QUERY_KEYS.HEALTH], queryFn: () => get<Health>(API_ENDPOINTS.HEALTH), refetchInterval: 60_000 })
