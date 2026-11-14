import { useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'

/**
 * Terms of Use, Privacy Policy and Cookie Policy updates. Publishing one
 * makes everyone in the audience accept it before they can keep using the
 * app or the vendor dashboard. The documents themselves live on the website.
 */
export type LegalAudience = 'users' | 'vendors' | 'everyone'
export type LegalDocumentKey = 'terms' | 'privacy' | 'cookies'

export interface LegalDocument {
  key: LegalDocumentKey
  title: string
  url: string
}

export interface LegalVersion {
  id: string
  audience: LegalAudience
  documents: LegalDocument[]
  summary: string
  publishedByName: string
  publishedAt: string
  userAcceptances: number
  vendorAcceptances: number
}

export interface LegalOverview {
  versions: LegalVersion[]
  documents: LegalDocument[]
  totalUsers: number
  totalVendorStaff: number
}

export interface PublishLegal {
  audience: LegalAudience
  documents: LegalDocumentKey[]
  summary: string
  reason: string
}

export const LEGAL_SUMMARY_MAX = 500

export const LEGAL_AUDIENCES: { value: LegalAudience; label: string; hint: string }[] = [
  { value: 'users', label: 'Users', hint: 'Everyone on the AutoVogue app' },
  { value: 'vendors', label: 'Vendors', hint: 'Everyone who signs in to the vendor dashboard' },
  { value: 'everyone', label: 'Everyone', hint: 'App users and vendor dashboard staff' },
]

export const useLegal = () =>
  useQuery({
    queryKey: [QUERY_KEYS.LEGAL],
    queryFn: () => get<LegalOverview>(API_ENDPOINTS.LEGAL),
    refetchInterval: 30_000,
  })

export const usePublishLegal = () =>
  useAdminMutation((body: PublishLegal) => send<LegalVersion>('post', API_ENDPOINTS.LEGAL, body), {
    invalidate: [[QUERY_KEYS.LEGAL]],
    success: 'Published: people must accept it the next time they open the app or dashboard',
  })
