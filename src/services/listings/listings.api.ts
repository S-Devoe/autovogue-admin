import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'
import type { Paged } from '../types'

export interface VehicleRow {
  id: string
  tenantId: string
  make: string
  model: string
  year: number
  licensePlate: string
  status: string
  isBookable: boolean
  locationState: string | null
  customDailyRateKobo: number | null
  takenDownAt: string | null
  takedownReason: string | null
  featuredRank: number | null
  createdAt: string
  vendorName: string
  coverPhoto: string
  rating: number
}

export const useVehicles = (f: { q?: string; status?: string; state?: string; takenDown?: boolean }) =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.VEHICLES, f],
    queryFn: ({ pageParam }) => get<Paged<VehicleRow>>(API_ENDPOINTS.VEHICLES, { ...f, cursor: pageParam, limit: 48 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export interface VehicleDetail {
  vehicle: VehicleRow & Record<string, any>
  photos: { id: string; photoUrl: string; isCover: boolean | null; displayOrder: number | null }[]
}

export const useVehicle = (id: string) => useQuery({ queryKey: [QUERY_KEYS.VEHICLE, id], queryFn: () => get<VehicleDetail>(API_ENDPOINTS.vehicle(id)) })

const keys = [[QUERY_KEYS.VEHICLES], [QUERY_KEYS.VEHICLE]]

export const useListingAction = () =>
  useAdminMutation((v: { id: string; action: 'takedown' | 'restore'; reason: string }) => send('post', API_ENDPOINTS.vehicleAction(v.id, v.action), { reason: v.reason }), {
    invalidate: keys,
  })

export const useRemovePhoto = () =>
  useAdminMutation((v: { id: string; photoId: string; reason: string }) => send('delete', API_ENDPOINTS.vehiclePhoto(v.id, v.photoId), { reason: v.reason }), {
    invalidate: keys,
  })

export interface ReviewRow {
  id: string
  bookingId: string
  vehicleId: string
  tenantId: string
  customerId: string
  rating: number
  comment: string | null
  vendorReply: string | null
  hiddenAt: string | null
  hiddenReason: string | null
  reportedAt: string | null
  reportReason: string | null
  createdAt: string
  customerName: string
  vehicleName: string
  vendorName: string
}

export const useReviews = (filter: 'queue' | 'hidden' | 'all') =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.REVIEWS, filter],
    queryFn: ({ pageParam }) => get<Paged<ReviewRow>>(API_ENDPOINTS.REVIEWS, { filter, cursor: pageParam, limit: 10 }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor || undefined,
  })

export const useReviewAction = () =>
  useAdminMutation((v: { id: string; action: 'hide' | 'restore'; reason: string }) => send('post', API_ENDPOINTS.reviewAction(v.id, v.action), { reason: v.reason }), {
    invalidate: [[QUERY_KEYS.REVIEWS], [QUERY_KEYS.ATTENTION]],
  })
