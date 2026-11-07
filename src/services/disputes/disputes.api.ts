import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from '../axios-api'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'
import type { IResponse, Paged } from '../types'
import type { BookingDetail } from '../bookings/bookings.api'

export interface DisputeRow {
  id: string
  bookingId: string
  raisedBy: 'customer' | 'tenant'
  category: string
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  description: string
  assigneeId: string | null
  assigneeName: string | null
  slaDueAt: string | null
  pausedAt: string | null
  createdAt: string
  fundState: string
  totalInvoiceKobo: number | null
  vendorPayoutKobo: number | null
  customerName: string
  vendorName: string
}

export const useDisputes = (f: { status?: string; assignee?: string; unassigned?: boolean }) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.DISPUTES, f],
    queryFn: ({ pageParam }) => get<Paged<DisputeRow>>(API_ENDPOINTS.DISPUTES, { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export interface DisputeWorkspace {
  dispute: DisputeRow & { raisedById: string; resolution: string | null; infoRequestedFrom: string | null; evidenceShared: boolean }
  evidence: string[]
  booking: BookingDetail
  resolution?: { outcome: string; refundKobo: number; releaseKobo: number; note: string; createdAt: string }
  hasChat: boolean
  slaSecondsLeft: number
}

export const useDispute = (id: string) =>
  useQuery({ queryKey: [QUERY_KEYS.DISPUTE, id], queryFn: () => get<DisputeWorkspace>(API_ENDPOINTS.dispute(id)), refetchInterval: 60_000 })

const keys = [[QUERY_KEYS.DISPUTE], [QUERY_KEYS.DISPUTES], [QUERY_KEYS.ATTENTION]]

export const useAssignDispute = () =>
  useAdminMutation((v: { id: string; staffId?: string }) => send('post', API_ENDPOINTS.disputeAction(v.id, 'assign'), { staffId: v.staffId ?? '' }), {
    invalidate: keys,
    success: 'Assigned',
  })

export const useRequestInfo = () =>
  useAdminMutation((v: { id: string; from: 'customer' | 'tenant'; message: string }) => send('post', API_ENDPOINTS.disputeAction(v.id, 'request-info'), v), {
    invalidate: keys,
  })

export const useResumeDispute = () => useAdminMutation((id: string) => send('post', API_ENDPOINTS.disputeAction(id, 'resume')), { invalidate: keys })

export type Outcome = 'renter' | 'vendor' | 'split' | 'no_money'

export const useResolveDispute = () =>
  useAdminMutation(
    (v: { id: string; outcome: Outcome; refundKobo: number; releaseKobo: number; penaltyKobo?: number; note: string }) => send('post', API_ENDPOINTS.disputeAction(v.id, 'resolve'), v),
    { invalidate: [...keys, [QUERY_KEYS.BOOKING], [QUERY_KEYS.PAYOUTS]] },
  )

export interface ChatMessage {
  id: string
  sender: string
  senderId: string
  body: string
  createdAt: string
}

/** Opening the chat is logged with the reason, so it's a deliberate action, not a cached query. */
export async function openDisputeChat(id: string, reason: string) {
  const { data } = await api.get<IResponse<ChatMessage[]>>(API_ENDPOINTS.disputeChat(id), { params: { reason } })
  return data.data
}

/** The booking chat behind a reported review (TRS-2). Logged with the reason. */
export async function openReviewChat(reviewId: string, reason: string) {
  const { data } = await api.get<IResponse<ChatMessage[]>>(API_ENDPOINTS.reviewChat(reviewId), { params: { reason } })
  return data.data
}
