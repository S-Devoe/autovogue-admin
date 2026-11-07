import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { api, ok, server } from '@/test/msw'
import { audienceLabel, contentProblems, isOwnLink, useAudiencePreview, type Audience } from './campaigns.api'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('campaign content rules (same as the API)', () => {
  it('allows first_name and AutoVogue links only', () => {
    expect(contentProblems('Hi {{first_name}}, see https://autovogue.app/deals')).toEqual([])
    expect(contentProblems('Hi {{balance}}')).toHaveLength(1)
    expect(contentProblems('go to https://autovogue.app.evil.com')).toHaveLength(1)
    expect(isOwnLink('http://autovogue.app')).toBe(false)
    expect(isOwnLink('https://staging.autovogue.app/x')).toBe(true)
  })
  it('describes the audience in words', () => {
    expect(audienceLabel({ kind: 'everyone' })).toBe('Everyone (users and vendors)')
    expect(audienceLabel({ kind: 'vendors', verified: 'no', vendorTypes: ['fleet_partner'], states: ['lagos'] })).toBe('All vendors, not yet verified, fleet partners, in Lagos')
  })
})

describe('useAudiencePreview', () => {
  it('posts the audience and returns who is reachable', async () => {
    let sent: unknown
    server.use(http.post(api('platform/campaigns/preview'), async ({ request }) => {
      sent = await request.json()
      return HttpResponse.json(ok({ total: 37, users: 19, vendors: 18, excluded: { suspended: 16, optedOut: 0, noEmail: 0 }, reachable: 21, inAppOnly: 0, sample: ['Ava'] }))
    }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const audience: Audience = { kind: 'everyone', verified: 'any', states: [], vendorTypes: [] }
    const { result } = renderHook(() => useAudiencePreview('email', 'marketing', audience), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })
    await waitFor(() => expect(result.current.data?.reachable).toBe(21))
    expect(sent).toEqual({ channel: 'email', kind: 'marketing', audience })
  })
})
