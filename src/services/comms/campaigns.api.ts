import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation, usePagedList } from '../request'

/**
 * Email and push campaigns. Each campaign is one channel. Users are people
 * on the AutoVogue app; vendors are businesses on the vendor dashboard.
 */
export type Channel = 'email' | 'push'
export type CampaignKind = 'service' | 'marketing'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'cancelled' | 'failed'

export interface Audience {
  kind: 'everyone' | 'users' | 'vendors'
  verified: 'any' | 'yes' | 'no'
  states: string[]
  vendorTypes: ('fleet_partner' | 'independent_host')[]
}

export interface Excluded {
  suspended: number
  optedOut: number
  noEmail: number
}

export interface Campaign {
  id: string
  name: string
  channel: Channel
  kind: CampaignKind
  audience: Partial<Audience>
  title: string
  body: string
  previewText?: string
  actionLabel?: string
  actionUrl?: string
  deepLink?: string
  status: CampaignStatus
  scheduledAt?: string
  startedAt?: string
  sentAt?: string
  cancelledAt?: string
  targeted: number
  sent: number
  /** Push only: FCM accepted it for at least one of the person's phones. */
  delivered: number
  failed: number
  excluded: Partial<Excluded>
  createdBy: string
  createdAt: string
}

export interface AudiencePreview {
  total: number
  users: number
  vendors: number
  excluded: Excluded
  reachable: number
  inAppOnly: number
  sample: string[]
}

export interface CampaignDraft {
  channel: Channel
  name: string
  kind: CampaignKind
  audience: Audience
  title: string
  body: string
  previewText?: string
  actionLabel?: string
  actionUrl?: string
  deepLink?: string
  sendAt?: string
}

export const PUSH_LIMITS = { title: 65, body: 240 }
export const EMAIL_LIMITS = { subject: 120, preview: 150, body: 5000 }

/** Screens a push can open in the AutoVogue app. Vendors open their notifications. */
export const DEEP_LINKS = [
  { value: 'notifications', label: 'Notifications' },
  { value: 'home', label: 'Home' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'verify', label: 'Identity verification' },
] as const

export const TOKENS = ['first_name'] as const

/** Same rules the API applies, so problems show while typing. */
export function contentProblems(...texts: (string | undefined)[]) {
  const all = texts.filter(Boolean).join('\n')
  const out = new Set<string>()
  for (const m of all.matchAll(/{{\s*([^}]*?)\s*}}/g)) {
    if (!(TOKENS as readonly string[]).includes(m[1] ?? '')) out.add(`{{${m[1]}}} isn't a known token. Use {{first_name}}.`)
  }
  for (const m of all.matchAll(/\bhttps?:\/\/[^\s"'<>)]+/gi)) {
    if (!isOwnLink(m[0])) out.add(`Links must point to autovogue.app: ${m[0]}`)
  }
  return [...out]
}

export function isOwnLink(raw: string) {
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    return u.protocol === 'https:' && (h === 'autovogue.app' || h.endsWith('.autovogue.app'))
  } catch {
    return false
  }
}

export const audienceLabel = (a: Partial<Audience>) => {
  const who = { everyone: 'Everyone (users and vendors)', users: 'All users', vendors: 'All vendors' }[a.kind ?? 'users'] ?? 'Users'
  const bits = [who]
  if (a.verified === 'yes') bits.push('verified only')
  if (a.verified === 'no') bits.push('not yet verified')
  if (a.vendorTypes?.length === 1) bits.push(a.vendorTypes[0] === 'fleet_partner' ? 'fleet partners' : 'individual hosts')
  if (a.states?.length) bits.push(`in ${a.states.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(', ')}`)
  return bits.join(', ')
}

const campaignKeys = [[QUERY_KEYS.CAMPAIGNS], [QUERY_KEYS.CAMPAIGN]]

export const useCampaigns = (channel: Channel) =>
  usePagedList<Campaign>([QUERY_KEYS.CAMPAIGNS], API_ENDPOINTS.CAMPAIGNS, { channel }, {
    refetchInterval: (q) => ((q as { state: { data?: { pages: { items: Campaign[] }[] } } }).state.data?.pages.some((p) => p.items.some((c) => c.status === 'sending')) ? 3000 : 15000),
  })

export const useCampaign = (id: string) =>
  useQuery({
    queryKey: [QUERY_KEYS.CAMPAIGN, id],
    queryFn: () => get<Campaign>(API_ENDPOINTS.campaign(id)),
    refetchInterval: (q) => (q.state.data?.status === 'sending' ? 2000 : false),
  })

export const useCampaignStates = () =>
  useQuery({ queryKey: [QUERY_KEYS.CAMPAIGN_STATES], queryFn: () => get<string[]>(API_ENDPOINTS.CAMPAIGN_STATES), staleTime: 5 * 60_000 })

/** Who the campaign would reach. A POST, but read-only on the API. */
export const useAudiencePreview = (channel: Channel, kind: CampaignKind, audience: Audience) =>
  useQuery({
    queryKey: [QUERY_KEYS.CAMPAIGN_PREVIEW, channel, kind, audience],
    queryFn: async () => (await send<AudiencePreview>('post', API_ENDPOINTS.CAMPAIGN_PREVIEW, { channel, kind, audience })).data,
    placeholderData: keepPreviousData,
  })

export const useTestCampaign = () =>
  useAdminMutation((d: CampaignDraft) => send('post', API_ENDPOINTS.CAMPAIGN_TEST, { ...d, sendAt: undefined }))

export const useCreateCampaign = () =>
  useAdminMutation((v: { draft: CampaignDraft; reason: string }) => send<Campaign>('post', API_ENDPOINTS.CAMPAIGNS, { ...v.draft, reason: v.reason }), {
    invalidate: campaignKeys,
    success: (r) => (r.data.status === 'scheduled' ? 'Campaign scheduled' : 'Campaign is sending'),
  })

export const useCampaignAction = () =>
  useAdminMutation(
    (v: { id: string; action: 'pause' | 'resume' | 'cancel'; reason?: string }) =>
      send<Campaign>('post', API_ENDPOINTS.campaignAction(v.id, v.action), v.reason ? { reason: v.reason } : {}),
    { invalidate: campaignKeys, success: (_, v) => ({ pause: 'Paused', resume: 'Sending again', cancel: 'Cancelled' })[v.action] },
  )
