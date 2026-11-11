import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, getOrNull, send, useAdminMutation, usePagedList } from '../request'
import type { Paged } from '../types'

export interface PaymentEvent {
  id: string
  bookingId: string
  eventType: string
  fundState: string
  amountKobo?: number
  gatewayReference?: string
  gatewayEventRef?: string
  disbursementRef?: string
  reasonCode?: string
  actorId?: string
  actorType?: string
  recipient?: string
  createdAt: string
}

const paged = <T,>(key: string, url: string, f: Record<string, unknown>) =>
  ({
    queryKey: [key, f],
    queryFn: ({ pageParam }: { pageParam: string }) => get<Paged<T>>(url, { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p: Paged<T>) => p.nextCursor || undefined,
  }) as const

export const usePayments = (f: { type?: string; bookingId?: string; reference?: string }) =>
  useInfiniteQuery(paged<PaymentEvent>(QUERY_KEYS.PAYMENTS, API_ENDPOINTS.PAYMENTS, f))

export const useRefunds = () => useInfiniteQuery(paged<PaymentEvent>(QUERY_KEYS.REFUNDS, API_ENDPOINTS.REFUNDS, {}))

export interface PayoutRow {
  id: string
  status: string
  fundState: string
  vendorPayoutKobo: number | null
  cautionFeeKobo: number
  payoutEligibleAt: string | null
  payoutReleasedAt: string | null
  payoutHeldAt: string | null
  payoutHoldReason: string | null
  disputeStatus: string | null
  endTime: string
  disbursementRefVendor: string | null
  tenantId: string
  vendorName: string
  lastFailure: string
}

export const usePayouts = (f: { state?: string; view?: string }) =>
  useInfiniteQuery(paged<PayoutRow>(QUERY_KEYS.PAYOUTS, API_ENDPOINTS.PAYOUTS, f))

const moneyKeys = [[QUERY_KEYS.PAYOUTS], [QUERY_KEYS.BOOKING], [QUERY_KEYS.BOOKINGS], [QUERY_KEYS.ATTENTION], [QUERY_KEYS.REFUNDS], [QUERY_KEYS.APPROVALS]]

export const usePayoutAction = () =>
  useAdminMutation((v: { id: string; action: 'hold' | 'release' | 'retry'; reason: string }) => send('post', API_ENDPOINTS.payoutAction(v.id, v.action), { reason: v.reason }), {
    invalidate: moneyKeys,
  })

export interface RefundResult {
  full: boolean
  refundedKobo: number
  feeKobo: number
  netKobo: number
  remainingKobo: number
  channel: string
  payoutHeld: boolean
}

export const useCreateRefund = () =>
  useAdminMutation((v: { bookingId: string; amountKobo: number; reason: string }) => send<RefundResult>('post', API_ENDPOINTS.REFUNDS, v), {
    invalidate: moneyKeys,
  })

export const useDisburse = () =>
  useAdminMutation((v: { id: string; reason: string }) => send('post', API_ENDPOINTS.disburse(v.id), { reason: v.reason }), { invalidate: moneyKeys })

export interface ReconRun {
  id: string
  triggeredBy: string | null
  triggeredByName: string | null
  status: string
  checkedCount: number
  mismatchCount: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface Mismatch {
  id: string
  runId: string
  bookingId: string | null
  kind: string
  detail: string
  resolvedAt: string | null
  resolvedByName: string | null
  resolutionNote: string | null
  createdAt: string
}

export const useReconRuns = () => usePagedList<ReconRun>([QUERY_KEYS.RECON_RUNS], API_ENDPOINTS.RECON_RUNS, {}, { refetchInterval: 10_000 })
export const useMismatches = (all: boolean) => usePagedList<Mismatch>([QUERY_KEYS.RECON_MISMATCHES], API_ENDPOINTS.RECON_MISMATCHES, { all })
export const useRunRecon = () => useAdminMutation(() => send('post', API_ENDPOINTS.RECON_RUNS), { invalidate: [[QUERY_KEYS.RECON_RUNS]] })
export const useResolveMismatch = () =>
  useAdminMutation((v: { id: string; reason: string }) => send('post', API_ENDPOINTS.resolveMismatch(v.id), { reason: v.reason }), {
    invalidate: [[QUERY_KEYS.RECON_MISMATCHES], [QUERY_KEYS.ATTENTION]],
  })

export interface WalletSummary {
  id: string
  userId: string
  balanceKobo: number
  status: string
  frozenAt?: string
  freezeReason?: string
  virtualAccountStatus: string
  virtualAccountNumber?: string
  virtualAccountBank?: string
  withdrawalBank?: string
  withdrawalAccountNumber?: string
  withdrawalAccountName?: string
  pinLocked: boolean
}

export interface WalletTx {
  id: string
  kind: string
  direction: string
  amountKobo: number
  balanceAfterKobo: number
  status: string
  reference: string
  bookingId: string | null
  description: string | null
  counterpartyName: string | null
  failureReason: string | null
  createdAt: string
}

export const useWallet = (userId?: string) =>
  useQuery({
    queryKey: [QUERY_KEYS.WALLET, userId],
    queryFn: () => getOrNull<{ wallet: WalletSummary; transactions: WalletTx[] }>(API_ENDPOINTS.wallet(userId!)),
    enabled: !!userId,
    retry: false,
  })

export const useWalletFreeze = () =>
  useAdminMutation((v: { userId: string; freeze: boolean; reason: string }) => send('post', API_ENDPOINTS.walletAction(v.userId, v.freeze ? 'freeze' : 'unfreeze'), { reason: v.reason }), {
    invalidate: [[QUERY_KEYS.WALLET], [QUERY_KEYS.USER]],
  })

export interface LedgerRow {
  tenantId: string
  vendorName: string
  bookings: number
  baseKobo: number
  commissionKobo: number
  vatKobo: number
  netKobo: number
  vendorPayoutKobo: number
}

export const useLedger = (from: string, to: string) =>
  useQuery({ queryKey: [QUERY_KEYS.LEDGER, from, to], queryFn: () => get<LedgerRow[]>(API_ENDPOINTS.LEDGER, { from, to }) })

export interface WebhookRow {
  id: string
  event: string
  reference?: string
  signatureOk: boolean
  statusCode: number
  receivedAt: string
}
/** Paystack webhooks as received, including ones whose signature failed (FIN-1). */
export const useWebhooks = (reference?: string) => usePagedList<WebhookRow>([QUERY_KEYS.WEBHOOKS], API_ENDPOINTS.WEBHOOKS, { reference })

/** Where all the money is, from the ledger (amounts in naira). */
/** One unpaid checkout on the Balances page. */
export interface OpenCheckout {
  bookingId: string
  ref: string
  customer: string
  vehicle: string
  amount: number
  startedAt: string
  expiresAt?: string
}

export interface PlatformBalances {
  heldAtPaystack: number
  inAutovogueBank: number
  invoicedNotPaid: number
  /** How many unpaid checkouts make up invoicedNotPaid. */
  openCheckouts?: number
  /** What the unpaid total would become if paid. */
  openCheckoutRental?: number
  openCheckoutCaution?: number
  openCheckoutServiceFee?: number
  openCheckoutVat?: number
  largestOpenCheckouts?: OpenCheckout[]
  owedToVendorsEscrow: number
  owedToVendorsWallets: number
  owedToUsersWallets: number
  cautionFeesHeld: number
  vatOwed: number
  commissionEarned: number
  refundFeesKept: number
  autovogueAtPaystack: number
  checks: {
    ledgerBalanced: boolean
    ledgerDifference: number
    userWalletsTotal: number
    userWalletsMatch: boolean
    vendorWalletsTotal: number
    vendorWalletsMatch: boolean
  }
}

export const usePlatformBalances = () =>
  useQuery({
    queryKey: [QUERY_KEYS.PLATFORM_BALANCES],
    queryFn: () => get<PlatformBalances>(API_ENDPOINTS.PLATFORM_BALANCES),
    refetchInterval: 60_000,
  })
