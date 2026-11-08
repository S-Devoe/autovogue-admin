import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'
import type { Paged } from '../types'

/**
 * In-app messages: a full-screen card shown once to each person in the
 * audience when they next open the app, the vendor dashboard or this admin.
 * Expired messages never show; several show one after another, oldest first.
 */
export type InAppAudience = 'users' | 'vendors' | 'staff' | 'everyone'
export type InAppStatus = 'draft' | 'live' | 'paused' | 'ended' | 'expired'

export interface InAppMessage {
  id: string
  title: string
  body: string
  imageUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  backgroundColor: string
  audience: InAppAudience
  status: InAppStatus
  startsAt?: string
  endsAt?: string
  createdBy: string
  createdByName?: string
  createdAt: string
  seen: number
  clicked: number
  dismissed: number
}

export interface InAppDraft {
  title: string
  body: string
  /** fileRef from an upload (also the public image URL). */
  imageUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  backgroundColor: string
  audience: InAppAudience
  startsAt?: string
  endsAt?: string
}

export const IN_APP_LIMITS = { title: 80, body: 500, cta: 30 }

export const AUDIENCES: { value: InAppAudience; label: string; hint: string }[] = [
  { value: 'users', label: 'Users', hint: 'People on the AutoVogue app' },
  { value: 'vendors', label: 'Vendors', hint: 'Everyone on the vendor dashboard' },
  { value: 'staff', label: 'Staff', hint: 'AutoVogue admins' },
  { value: 'everyone', label: 'Everyone', hint: 'Users, vendors and staff' },
]

/** Screens a button can open in the AutoVogue app. */
export const APP_LINKS = [
  { value: 'autovogue://home', label: 'App: Home' },
  { value: 'autovogue://search', label: 'App: Search' },
  { value: 'autovogue://bookings', label: 'App: Bookings' },
  { value: 'autovogue://wallet', label: 'App: Wallet' },
] as const

export const SWATCHES = ['#7EA6E0', '#0A0D14', '#F5C451', '#2FB57A', '#E8505B', '#F4EFE6']

/** Same rules the API applies, so problems show while typing. */
export function draftProblems(d: InAppDraft): string[] {
  const out: string[] = []
  if (!d.title.trim()) out.push('Add a title.')
  if (d.title.length > IN_APP_LIMITS.title) out.push(`Title is over ${IN_APP_LIMITS.title} characters.`)
  if (!d.body.trim()) out.push('Add a message.')
  if (d.body.length > IN_APP_LIMITS.body) out.push(`Message is over ${IN_APP_LIMITS.body} characters.`)
  if (!/^#[0-9A-Fa-f]{6}$/.test(d.backgroundColor)) out.push('Background colour must look like #7EA6E0.')
  const label = d.ctaLabel?.trim() ?? ''
  const url = d.ctaUrl?.trim() ?? ''
  if ((label === '') !== (url === '')) out.push('Give the button both a label and a link, or neither.')
  if (label.length > IN_APP_LIMITS.cta) out.push(`Button label is over ${IN_APP_LIMITS.cta} characters.`)
  if (url && !/^(https:\/\/[^\s]+|autovogue:\/\/[a-z-]+)$/i.test(url)) out.push('The button link must start with https:// or autovogue://.')
  if (d.endsAt && d.startsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt)) out.push('The end time must be after the start time.')
  if (d.endsAt && Date.parse(d.endsAt) < Date.now()) out.push('The end time is already in the past.')
  return out
}

/** Dark text on light cards, light text on dark ones (same rule as the app). */
export function textOn(hex: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return '#0A0D14'
  const lin = (v: string) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * lin(m[1]!) + 0.7152 * lin(m[2]!) + 0.0722 * lin(m[3]!)
  // Whichever of dark or white text has more contrast with the card.
  const dark = (l + 0.05) / (0.0045 + 0.05)
  const white = 1.05 / (l + 0.05)
  return dark >= white ? '#0A0D14' : '#FFFFFF'
}

// This list answers { items, meta: { nextCursor } }.
interface MetaPage<T> {
  items: T[]
  meta?: { nextCursor?: string | null }
}

export const useInAppMessages = () =>
  useInfiniteQuery({
    queryKey: [QUERY_KEYS.IN_APP_MESSAGES],
    queryFn: async ({ pageParam }): Promise<Paged<InAppMessage>> => {
      const p = await get<MetaPage<InAppMessage>>(API_ENDPOINTS.IN_APP_MESSAGES, { cursor: pageParam, limit: 20 })
      return { items: p.items ?? [], nextCursor: p.meta?.nextCursor ?? undefined }
    },
    initialPageParam: '',
    getNextPageParam: (p: Paged<InAppMessage>) => p.nextCursor || undefined,
    refetchInterval: 30_000,
  })

const invalidate = [[QUERY_KEYS.IN_APP_MESSAGES]]

export const useCreateInApp = () =>
  useAdminMutation((d: InAppDraft) => send<InAppMessage>('post', API_ENDPOINTS.IN_APP_MESSAGES, d), {
    invalidate,
    success: 'Draft saved',
  })

export const useUpdateInApp = () =>
  useAdminMutation(({ id, draft }: { id: string; draft: InAppDraft }) =>
    send<InAppMessage>('put', API_ENDPOINTS.inAppMessage(id), draft), { invalidate, success: 'Saved' })

const STATUS_DONE: Record<'live' | 'paused' | 'ended', string> = {
  live: 'Live: people see it the next time they open the app',
  paused: 'Paused: nobody new sees it',
  ended: 'Ended: it will not show again',
}

export const useSetInAppStatus = () =>
  useAdminMutation(({ id, status }: { id: string; status: 'live' | 'paused' | 'ended' }) =>
    send<InAppMessage>('post', API_ENDPOINTS.inAppMessageStatus(id), { status }), {
    invalidate,
    success: (_r, v) => STATUS_DONE[v.status],
  })

interface Presigned {
  uploadUrl: string
  method: string
  headers: Record<string, string>
  fileRef: string
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Uploads artwork straight to storage; returns the public image URL. */
export async function uploadInAppImage(file: File): Promise<string> {
  const { data } = await send<Presigned>('post', API_ENDPOINTS.PLATFORM_UPLOADS, {
    purpose: 'campaign_image',
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  })
  // Plain axios: the presigned URL is on storage, not the API, so no auth header.
  await axios.request({ method: data.method || 'PUT', url: data.uploadUrl, data: file, headers: data.headers })
  return data.fileRef
}

// The signed-in staff member's own messages.

export type InAppAction = 'seen' | 'clicked' | 'dismissed'

export const useMyNextInApp = () =>
  useQuery({
    queryKey: [QUERY_KEYS.MY_IN_APP],
    queryFn: () => get<InAppMessage | null>(API_ENDPOINTS.MY_IN_APP_NEXT),
    staleTime: Infinity,
    retry: false,
  })

export const recordMyInApp = (id: string, action: InAppAction) =>
  send('post', API_ENDPOINTS.myInAppEvent(id), { action })
