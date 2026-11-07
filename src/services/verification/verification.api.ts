import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, getOrNull, send, useAdminMutation, usePagedList } from '../request'
import type { Paged } from '../types'

export type Queue = 'renters' | 'hosts' | 'fleet'

export interface QueueDoc {
  id: string
  userId?: string
  tenantId?: string
  documentType: string
  documentUrl: string | null
  provider: string | null
  status: 'pending' | 'verified' | 'rejected' | 'failed' | null
  verificationMode: 'synchronous' | 'asynchronous' | 'manual' | null
  rejectionReason: string | null
  nameMatched: boolean | null
  dobMatched: boolean | null
  documentPurgedAt: string | null
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  email?: string
  tenantType?: string
  vendorName?: string
  revokedAt?: string | null
  secondReviewBy?: string | null
  secondReviewByName?: string
  secondReviewNote?: string | null
}

export interface QueueFilters {
  status?: string
  mode?: string
  type?: string
}

export const useVerifyQueue = (queue: Queue, f: QueueFilters) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.VERIFY_QUEUE, queue, f],
    queryFn: ({ pageParam }) => get<Paged<QueueDoc>>(API_ENDPOINTS.verifyQueue(queue), { ...f, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export interface DriverDoc {
  id: string
  driverId: string
  tenantId: string
  documentType: string
  documentUrl: string
  status: string
  expiresAt: string
  driverName?: string
  createdAt: string
}

/** A first upload, or a renewal of an approved document (the car stays bookable meanwhile). */
export interface VehicleDoc {
  id: string
  vehicleId: string
  documentType: string
  isRenewal: boolean
  /** The file to review (the new one for a renewal). */
  fileRef: string
  /** Renewals only: the document currently approved. */
  currentFileRef?: string
  expiresAt?: string
  currentExpiresAt?: string
  submittedAt: string
  car: string
  licensePlate: string
  vehicleStatus: string
  tenantId: string
  vendorName: string
}

export const useDriverQueue = () =>
  useQuery({ queryKey: [QUERY_KEYS.VERIFY_DRIVERS], queryFn: () => get<DriverDoc[]>(API_ENDPOINTS.VERIFY_DRIVERS) })
export const useVehicleDocQueue = () => usePagedList<VehicleDoc>([QUERY_KEYS.VERIFY_VEHICLES], API_ENDPOINTS.VERIFY_VEHICLES)

export interface Identity {
  legalName: string
  kind: string
  sourceDocumentType: string
  provider: string
  verifiedAt?: string
}

export const useIdentity = (type: 'user' | 'tenant', id?: string) =>
  useQuery({
    queryKey: [QUERY_KEYS.IDENTITY, type, id],
    queryFn: () => getOrNull<Identity>(API_ENDPOINTS.identity(type, id!)),
    enabled: !!id,
  })

export const REJECTION_REASONS = [
  { code: 'blurry', label: 'Blurry or unreadable' },
  { code: 'expired', label: 'Expired document' },
  { code: 'name_mismatch', label: "Name doesn't match profile" },
  { code: 'wrong_document', label: 'Wrong document' },
  { code: 'edited_image', label: 'Image looks edited' },
] as const

export type DocKind = 'user' | 'tenant' | 'driver' | 'vehicle'

const decideUrl = (kind: DocKind, id: string) =>
  ({ user: API_ENDPOINTS.decideUserDoc, tenant: API_ENDPOINTS.decideTenantDoc, driver: API_ENDPOINTS.decideDriverDoc, vehicle: API_ENDPOINTS.decideVehicleDoc })[kind](id)

export interface Decision {
  kind: DocKind
  id: string
  approve: boolean
  reasonCode?: string
  note?: string
  legalName?: string
}

/** Approve or reject a document. Driver and vehicle docs use APPROVED/REJECTED. */
export const useDecideDocument = () =>
  useAdminMutation(
    (d: Decision) => {
      const people = d.kind === 'user' || d.kind === 'tenant'
      const status = people ? (d.approve ? 'verified' : 'rejected') : d.approve ? 'APPROVED' : 'REJECTED'
      const body: Record<string, unknown> = { status }
      if (!d.approve) {
        if (people) {
          body.reasonCode = d.reasonCode
          body.rejectionReason = d.note ?? ''
        } else if (d.kind === 'vehicle') {
          // The API turns the code into the editable label (Settings, Content).
          body.reasonCode = d.reasonCode
          body.rejectionReason = d.note ?? ''
        } else {
          body.rejectionReason = [d.reasonCode && labelFor(d.reasonCode), d.note].filter(Boolean).join('. ')
        }
      }
      if (d.approve && d.legalName) body.legalName = d.legalName
      return send('patch', decideUrl(d.kind, d.id), body)
    },
    {
      invalidate: [[QUERY_KEYS.VERIFY_QUEUE], [QUERY_KEYS.VERIFY_DRIVERS], [QUERY_KEYS.VERIFY_VEHICLES], [QUERY_KEYS.ATTENTION]],
      success: (_, v) => (v.approve ? 'Approved; they were notified' : 'Rejected; they were told why'),
    },
  )

const labelFor = (code: string) => REJECTION_REASONS.find((r) => r.code === code)?.label ?? code

export interface KycPending {
  documentId: string
  subjectType: string
  subjectId: string
  documentType: string
  attempts: number | null
  lastError: string | null
  nextAttemptAt: string
  createdAt: string
}

export const useKycPending = () => usePagedList<KycPending>([QUERY_KEYS.KYC_PENDING], API_ENDPOINTS.KYC_PENDING)

export const useRetryKyc = () =>
  useAdminMutation((id: string) => send('post', API_ENDPOINTS.kycRetry(id)), { invalidate: [[QUERY_KEYS.KYC_PENDING]] })

export interface ExpiringDoc {
  id: string
  vehicleId: string
  documentType: string
  status: string
  expiresAt: string
  make: string
  model: string
  licensePlate: string
  tenantId: string
  vendorName: string
}

export const useExpiringDocs = (days = 30) => usePagedList<ExpiringDoc>([QUERY_KEYS.EXPIRING_DOCS], API_ENDPOINTS.EXPIRING_DOCS, { days })

export const useRevokeDoc = () =>
  useAdminMutation((v: { kind: 'users' | 'tenants'; id: string; reason: string }) => send('post', API_ENDPOINTS.revokeDoc(v.kind, v.id), { reason: v.reason }), {
    invalidate: [[QUERY_KEYS.VERIFY_QUEUE], [QUERY_KEYS.USER], [QUERY_KEYS.TENANT]],
    success: 'Verification revoked',
  })

export const useSecondReview = () =>
  useAdminMutation((v: { id: string; note: string }) => send('post', API_ENDPOINTS.secondReview(v.id), v), {
    invalidate: [[QUERY_KEYS.VERIFY_QUEUE]],
  })

export const useRemindVendor = () => useAdminMutation((id: string) => send('post', API_ENDPOINTS.remindDoc(id)), { success: 'Reminder sent' })

export interface NameChange {
  id: string
  userId: string
  firstName: string
  lastName: string
  note: string | null
  status: string
  createdAt: string
  currentFirstName: string
  currentLastName: string
  email: string
  verifiedLegalName: string
  matches: boolean
  decisionNote: string | null
}

export const useNameChanges = (status: string) => usePagedList<NameChange>([QUERY_KEYS.NAME_CHANGES], API_ENDPOINTS.NAME_CHANGES, { status })

export const useDecideNameChange = () =>
  useAdminMutation((v: { id: string; approve: boolean; note: string }) => send('post', API_ENDPOINTS.decideNameChange(v.id), v), {
    invalidate: [[QUERY_KEYS.NAME_CHANGES]],
  })
