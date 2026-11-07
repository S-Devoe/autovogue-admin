import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from '../axios-api'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation, usePagedList } from '../request'
import type { Paged } from '../types'
import type { Grant } from '../auth/auth.api'

// ---------------- Platform settings ----------------
export interface ConfigItem {
  key: string
  label: string
  description: string
  kind: 'bps' | 'kobo' | 'int' | 'bool'
  money: boolean
  min: number
  max: number
  value: string
  source: 'config' | 'default' | 'general'
  updatedAt?: string
  pendingChange: boolean
}

export interface SwitchItem {
  key: string
  label: string
  paused: boolean
}

export const useConfig = () =>
  useQuery({ queryKey: [QUERY_KEYS.CONFIG], queryFn: () => get<{ settings: ConfigItem[]; switches: SwitchItem[] }>(API_ENDPOINTS.CONFIG) })

export interface ConfigHistoryItem {
  id: string
  key: string
  oldValue?: string
  newValue: string
  changedByName?: string
  approvedByName?: string
  reason?: string
  createdAt: string
}

export const useConfigHistory = () => usePagedList<ConfigHistoryItem>([QUERY_KEYS.CONFIG_HISTORY], API_ENDPOINTS.CONFIG_HISTORY)

export const useProposeConfig = () =>
  useAdminMutation((v: { key: string; value: string; reason: string }) => send('post', API_ENDPOINTS.CONFIG_PROPOSALS, v), {
    invalidate: [[QUERY_KEYS.CONFIG], [QUERY_KEYS.CONFIG_HISTORY], [QUERY_KEYS.APPROVALS], [QUERY_KEYS.ATTENTION]],
  })

export const useToggleSwitch = () =>
  useAdminMutation((v: { key: string; paused: boolean; reason: string }) => send('post', API_ENDPOINTS.CONFIG_SWITCHES, v), {
    invalidate: [[QUERY_KEYS.CONFIG], [QUERY_KEYS.CONFIG_HISTORY]],
    success: (_, v) => (v.paused ? 'Paused' : 'Resumed'),
  })

// ---------------- Approvals ----------------
export interface Approval {
  id: string
  kind: string
  targetType?: string
  targetId?: string
  summary: string
  payload: unknown
  approvePermission: string
  proposedBy: string
  proposedByName?: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'failed'
  decidedByName?: string
  decisionNote?: string
  decidedAt?: string
  failure?: string
  createdAt: string
  canDecide: boolean
}

export const useApprovals = (status: string) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.APPROVALS, status],
    queryFn: ({ pageParam }) => get<Paged<Approval>>(API_ENDPOINTS.APPROVALS, { status, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export const useDecideApproval = () =>
  useAdminMutation((v: { id: string; approve: boolean; note: string }) => send('post', API_ENDPOINTS.approvalAction(v.id, v.approve ? 'approve' : 'reject'), { note: v.note }), {
    invalidate: [[QUERY_KEYS.APPROVALS], [QUERY_KEYS.ATTENTION], [QUERY_KEYS.CONFIG], [QUERY_KEYS.ROLES], [QUERY_KEYS.CONFIG_HISTORY]],
  })

// ---------------- Staff and roles ----------------
export interface StaffRow {
  id: string
  email: string
  fullName: string
  isActive: boolean
  twoFactorOn: boolean
  lastLoginAt?: string
  deactivatedAt?: string
  createdAt: string
  roleIds: string[]
  roleNames: string[]
  /** Data-protection training recorded; needed to sign in. */
  trainedAt?: string
}

export const useStaff = () => useQuery({ queryKey: [QUERY_KEYS.STAFF], queryFn: () => get<StaffRow[]>(API_ENDPOINTS.STAFF) })

export interface InviteRow {
  id: string
  email: string
  fullName: string
  roleIds: string[]
  expiresAt: string
  createdAt: string
}

export const useInvites = () => useQuery({ queryKey: [QUERY_KEYS.STAFF_INVITES], queryFn: () => get<InviteRow[]>(API_ENDPOINTS.STAFF_INVITES) })

const staffKeys = [[QUERY_KEYS.STAFF], [QUERY_KEYS.STAFF_INVITES], [QUERY_KEYS.STAFF_PERMISSIONS], [QUERY_KEYS.ROLES]]

export const useInviteStaff = () =>
  useAdminMutation((v: { email: string; fullName: string; roleIds: string[] }) => send('post', API_ENDPOINTS.STAFF_INVITES, v), {
    invalidate: staffKeys,
    success: 'Invite sent. The link works for 48 hours',
  })
export const useRevokeInvite = () => useAdminMutation((id: string) => send('post', API_ENDPOINTS.revokeInvite(id)), { invalidate: staffKeys })
export const useSetStaffRoles = () =>
  useAdminMutation((v: { id: string; roleIds: string[]; reason: string }) => send('put', API_ENDPOINTS.staffRoles(v.id), v), {
    invalidate: staffKeys,
    success: 'Roles updated (applies within a minute)',
  })
export const useStaffAction = () =>
  useAdminMutation((v: { id: string; action: 'deactivate' | 'reactivate' | 'reset-2fa' | 'training'; reason: string }) => send('post', API_ENDPOINTS.staffAction(v.id, v.action), { reason: v.reason }), {
    invalidate: staffKeys,
  })

export const useStaffPermissions = (id?: string) =>
  useQuery({
    queryKey: [QUERY_KEYS.STAFF_PERMISSIONS, id],
    queryFn: () => get<{ staffId: string; isSuperAdmin: boolean; grants: Grant[] }>(API_ENDPOINTS.staffPermissions(id!)),
    enabled: !!id,
  })

export interface Permission {
  key: string
  area: string
  description: string
  sensitive: boolean
}

export const usePermissionCatalog = () =>
  useQuery({ queryKey: [QUERY_KEYS.PERMISSIONS], queryFn: () => get<Permission[]>(API_ENDPOINTS.PERMISSIONS), staleTime: 10 * 60_000 })

export interface Role {
  id: string
  name: string
  purpose: string
  isSystem: boolean
  isSuper: boolean
  viewOnly: boolean
  disabled: boolean
  staffCount: number
  permissionKeys: string[]
  createdAt: string
  updatedAt: string
  history?: { change: string; beforeKeys: string[] | null; afterKeys: string[] | null; changedByName?: string; reason?: string; createdAt: string }[]
  pendingChange?: boolean
}

export const useRoles = () => useQuery({ queryKey: [QUERY_KEYS.ROLES], queryFn: () => get<Role[]>(API_ENDPOINTS.ROLES) })
export const useRole = (id?: string) =>
  useQuery({ queryKey: [QUERY_KEYS.ROLE, id], queryFn: () => get<Role>(API_ENDPOINTS.role(id!)), enabled: !!id })

export interface RoleInput {
  name: string
  purpose: string
  viewOnly: boolean
  permissionKeys: string[]
  reason: string
}

const roleKeys = [[QUERY_KEYS.ROLES], [QUERY_KEYS.ROLE], [QUERY_KEYS.APPROVALS]]
export const useSaveRole = () =>
  useAdminMutation((v: RoleInput & { id?: string }) => (v.id ? send('patch', API_ENDPOINTS.role(v.id), v) : send('post', API_ENDPOINTS.ROLES, v)), {
    invalidate: roleKeys,
  })
export const useCloneRole = () =>
  useAdminMutation((v: { id: string; name: string; reason: string }) => send('post', API_ENDPOINTS.roleClone(v.id), v), { invalidate: roleKeys })
export const useDisableRole = () =>
  useAdminMutation((v: { id: string; disabled: boolean; reason: string }) => send('post', API_ENDPOINTS.roleDisable(v.id), v), { invalidate: roleKeys })

export interface AccessReviewRow {
  staff: StaffRow
  permissions: string[]
  decision?: string
  reviewedAt?: string
}

export const useAccessReview = (enabled: boolean) =>
  useQuery({ queryKey: [QUERY_KEYS.ACCESS_REVIEW], queryFn: () => get<AccessReviewRow[]>(API_ENDPOINTS.ACCESS_REVIEW), enabled })
export const useDecideAccessReview = () =>
  useAdminMutation((v: { staffId: string; decision: 'confirm' | 'change'; note?: string }) => send('post', API_ENDPOINTS.accessReviewDecide(v.staffId), v), {
    invalidate: [[QUERY_KEYS.ACCESS_REVIEW]],
    success: 'Recorded',
  })

// ---------------- Audit ----------------
export interface AuditEntry {
  id: string
  staffId?: string
  staffEmail?: string
  action: string
  targetType?: string
  targetId?: string
  reason?: string
  before?: unknown
  after?: unknown
  statusCode?: number
  ip?: string
  userAgent?: string
  requestId?: string
  createdAt: string
}

export interface AuditFilters {
  staffId?: string
  targetType?: string
  targetId?: string
  action?: string
  from?: string
  to?: string
}

export const useAudit = (f: AuditFilters) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.AUDIT, f],
    queryFn: ({ pageParam }) => get<Paged<AuditEntry>>(API_ENDPOINTS.AUDIT, { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

/** Downloads a CSV through the API client (cookie + no caching). */
export async function downloadCsv(url: string, params: Record<string, unknown>, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

// ---------------- Comms ----------------

// ---------------- Privacy (NDPR) ----------------
export interface DsrRequest {
  id: string
  subjectType: string
  subjectId: string | null
  requesterEmail: string
  kind: 'copy' | 'erasure' | 'correction'
  status: 'open' | 'in_progress' | 'completed' | 'rejected'
  notes: string | null
  dueAt: string
  completedAt: string | null
  createdAt: string
}

export interface Breach {
  id: string
  summary: string
  detectedAt: string
  notifyBy: string
  severity: 'low' | 'medium' | 'high'
  personalData: boolean
  status: 'open' | 'contained' | 'notified' | 'closed'
  ndpcNotifiedAt: string | null
  createdAt: string
}

export const useDsr = (enabled: boolean) => usePagedList<DsrRequest>([QUERY_KEYS.DSR], API_ENDPOINTS.DSR, {}, { enabled })
export const useBreaches = (enabled: boolean) => usePagedList<Breach>([QUERY_KEYS.BREACHES], API_ENDPOINTS.BREACHES, {}, { enabled })
export const useCreateDsr = () =>
  useAdminMutation((v: Record<string, string>) => send('post', API_ENDPOINTS.DSR, v), { invalidate: [[QUERY_KEYS.DSR], [QUERY_KEYS.ATTENTION]], success: 'Request logged (due in 30 days)' })
export const useUpdateDsr = () =>
  useAdminMutation((v: { id: string; status: string; notes?: string }) => send('patch', API_ENDPOINTS.dsr(v.id), v), { invalidate: [[QUERY_KEYS.DSR], [QUERY_KEYS.ATTENTION]] })
export const useCreateBreach = () =>
  useAdminMutation((v: { summary: string; detectedAt: string; severity: string; personalData: boolean }) => send('post', API_ENDPOINTS.BREACHES, v), {
    invalidate: [[QUERY_KEYS.BREACHES], [QUERY_KEYS.ATTENTION]],
    success: 'Breach recorded. NDPC deadline is 72 hours from detection',
  })
export const useUpdateBreach = () =>
  useAdminMutation((v: { id: string; status: string }) => send('patch', API_ENDPOINTS.breach(v.id), v), { invalidate: [[QUERY_KEYS.BREACHES], [QUERY_KEYS.ATTENTION]] })


export interface Content {
  rejectionReasons: { code: string; label: string }[]
  disputeCategories: Record<string, string>
  cancellationPolicy: string
}
export const useContent = () => useQuery({ queryKey: [QUERY_KEYS.CONTENT], queryFn: () => get<Content>(API_ENDPOINTS.CONTENT) })
export const useSaveContent = () =>
  useAdminMutation((v: Partial<Content> & { reason: string }) => send<Content>('put', API_ENDPOINTS.CONTENT, v), { invalidate: [[QUERY_KEYS.CONTENT]] })

export interface Charts {
  byDay: { day: string; bookings: number; paid: number; valueKobo: number }[]
  byState: { state: string; bookings: number; valueKobo: number }[]
  byVendorType: { vendorType: string; bookings: number; valueKobo: number }[]
  funnel: { signedUp: number; submitted: number; verified: number; booked: number }
  trips: number
  disputes: number
  disputesPer100Trips: number
}
export const useCharts = (range: string) => useQuery({ queryKey: [QUERY_KEYS.CHARTS, range], queryFn: () => get<Charts>(API_ENDPOINTS.CHARTS, { range }) })
