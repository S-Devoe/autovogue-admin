import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api from './axios-api'
import { send } from './request'
import { onSessionExpired, onStepUpRequest, setCsrf } from './session'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

const seen: InternalAxiosRequestConfig[] = []
function respond(fn: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }): AxiosAdapter {
  return async (config) => {
    seen.push(config)
    const { status, data } = fn(config)
    const res = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) throw Object.assign(new Error('fail'), { config, response: res, isAxiosError: true })
    return res
  }
}

afterEach(() => {
  seen.length = 0
  setCsrf(null)
  onStepUpRequest(null)
  onSessionExpired(null)
})

describe('writes', () => {
  it('send a fresh Idempotency-Key and the CSRF token', async () => {
    setCsrf('csrf-1')
    api.defaults.adapter = respond(() => ({ status: 200, data: { data: {}, message: 'ok' } }))
    await send('post', 'platform/refunds', { a: 1 })
    await send('post', 'platform/refunds', { a: 1 })
    expect(seen[0].headers['X-CSRF-Token']).toBe('csrf-1')
    expect(seen[0].headers['Idempotency-Key']).toBeTruthy()
    expect(seen[0].headers['Idempotency-Key']).not.toBe(seen[1].headers['Idempotency-Key'])
  })

  it('report 202 as waiting for approval', async () => {
    api.defaults.adapter = respond(() => ({ status: 202, data: { data: {}, message: 'queued' } }))
    const r = await send('post', 'platform/refunds', {})
    expect(r.needsApproval).toBe(true)
  })

  it('do not put the CSRF token on reads', async () => {
    setCsrf('csrf-1')
    api.defaults.adapter = respond(() => ({ status: 200, data: { data: [] } }))
    await api.get('platform/bookings')
    expect(seen[0].headers['X-CSRF-Token']).toBeUndefined()
  })
})

describe('step-up', () => {
  it('asks for a code, then retries the same request with the same key', async () => {
    let calls = 0
    api.defaults.adapter = respond(() => {
      calls++
      return calls === 1 ? { status: 403, data: { code: 'STEP_UP_REQUIRED', message: 'code' } } : { status: 200, data: { data: { ok: true }, message: 'done' } }
    })
    onStepUpRequest((resolve) => resolve(true))
    const r = await send<{ ok: boolean }>('post', 'platform/refunds', {})
    expect(r.data.ok).toBe(true)
    expect(seen).toHaveLength(2)
    expect(seen[0].headers['Idempotency-Key']).toBe(seen[1].headers['Idempotency-Key'])
  })
})

describe('session expiry', () => {
  it('tells the app to sign in again', async () => {
    const expired = vi.fn()
    onSessionExpired(expired)
    api.defaults.adapter = respond(() => ({ status: 401, data: { code: 'SESSION_EXPIRED', message: 'Your session has ended' } }))
    await expect(api.get('platform/bookings')).rejects.toBeTruthy()
    expect(expired).toHaveBeenCalledWith('Your session has ended')
  })
})
