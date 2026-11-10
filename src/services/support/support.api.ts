import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'

export type TicketStatus = 'open' | 'in_progress' | 'awaiting_reply' | 'closed'
export type TicketCategory = 'booking' | 'payment' | 'account' | 'verification' | 'vehicle' | 'other'
export type RequesterType = 'user' | 'tenant'

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  awaiting_reply: 'Awaiting reply',
  closed: 'Closed',
}

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'booking', label: 'Booking' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'verification', label: 'Verification' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
]

export const categoryLabel = (c: string) => TICKET_CATEGORIES.find((x) => x.value === c)?.label ?? c
export const requesterLabel = (t: RequesterType) => (t === 'tenant' ? 'Vendor' : 'User')

export interface AdminTicket {
  id: string
  reference: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  requesterType: RequesterType
  requesterId: string
  requesterName: string
  /** Detail only. */
  requesterEmail?: string
  /** The vendor team member who opened it (detail only). */
  openedByName?: string
  bookingId?: string
  bookingReference?: string
  assignee: { id: string; name: string } | null
  lastMessageAt: string
  lastMessageBy: 'requester' | 'staff' | 'system'
  createdAt: string
  closedAt?: string
  closedBy?: 'requester' | 'staff' | 'system'
}

export interface AdminTicketMessage {
  id: string
  from: 'requester' | 'staff' | 'system'
  authorName: string
  internal: boolean
  body: string
  createdAt: string
}

export interface AdminTicketDetail extends AdminTicket {
  messages: AdminTicketMessage[]
}

interface TicketPage {
  tickets: AdminTicket[]
  meta: { limit: number; hasMore: boolean; nextCursor: string | null }
}

export interface SupportCounts {
  open: number
  inProgress: number
  awaitingReply: number
  unassigned: number
  mine: number
}

export interface SupportAssignee {
  id: string
  name: string
  email: string
}

export interface TicketFilters {
  status?: TicketStatus | 'active'
  assignee?: 'me' | 'unassigned'
  requesterType?: RequesterType
  category?: string
  q?: string
}

export const useSupportTickets = (f: TicketFilters) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.SUPPORT_TICKETS, f],
    queryFn: ({ pageParam }) => get<TicketPage>(API_ENDPOINTS.SUPPORT_TICKETS, { ...f, cursor: pageParam, limit: 25 }),
    initialPageParam: '',
    getNextPageParam: (p) => (p.meta.hasMore && p.meta.nextCursor) || undefined,
  })

/** Queue counts for the tabs and the nav badge. Refreshes every 2 minutes while the tab is visible. */
export const useSupportCounts = (enabled = true) =>
  useQuery({
    queryKey: [QUERY_KEYS.SUPPORT_COUNTS],
    queryFn: () => get<SupportCounts>(API_ENDPOINTS.SUPPORT_COUNTS),
    enabled,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  })

export const useSupportAssignees = (enabled = true) =>
  useQuery({
    queryKey: [QUERY_KEYS.SUPPORT_ASSIGNEES],
    queryFn: () => get<SupportAssignee[]>(API_ENDPOINTS.SUPPORT_ASSIGNEES),
    enabled,
    staleTime: 5 * 60_000,
  })

/** One ticket. `poll` turns the 60 second refresh on (the page decides when). */
export const useSupportTicket = (id: string, poll: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.SUPPORT_TICKET, id],
    queryFn: () => get<AdminTicketDetail>(API_ENDPOINTS.supportTicket(id)),
    refetchInterval: (q) => (poll && q.state.data?.status !== 'closed' ? 60_000 : false),
    refetchIntervalInBackground: false,
  })

const keys = [[QUERY_KEYS.SUPPORT_TICKET], [QUERY_KEYS.SUPPORT_TICKETS], [QUERY_KEYS.SUPPORT_COUNTS]]

export const useReplyToTicket = () =>
  useAdminMutation(
    (v: { id: string; body: string; internal: boolean }) =>
      send<AdminTicketDetail>('post', API_ENDPOINTS.supportTicketAction(v.id, 'messages'), { body: v.body, internal: v.internal }),
    { invalidate: keys, success: (_r, v) => (v.internal ? 'Internal note added' : 'Reply sent') },
  )

export const useAssignTicket = () =>
  useAdminMutation(
    (v: { id: string; staffId?: string }) => send<AdminTicketDetail>('post', API_ENDPOINTS.supportTicketAction(v.id, 'assign'), { staffId: v.staffId ?? '' }),
    { invalidate: keys },
  )

export const useSetTicketStatus = () =>
  useAdminMutation(
    (v: { id: string; status: TicketStatus }) => send<AdminTicketDetail>('post', API_ENDPOINTS.supportTicketAction(v.id, 'status'), { status: v.status }),
    { invalidate: keys, success: (_r, v) => (v.status === 'closed' ? 'Ticket closed' : 'Status updated') },
  )
