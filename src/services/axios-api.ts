import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { API_BASE_URL } from '@/lib/env'
import { errorMessage, type ApiError } from './types'
import { getCsrf, requestStepUp, sessionExpired, setCsrf } from './session'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Don't toast errors for this request (the caller shows them). */
    silent?: boolean
    _steppedUp?: boolean
  }
}

const UNSAFE = new Set(['post', 'put', 'patch', 'delete'])
const SESSION_CODES = new Set(['SESSION_REQUIRED', 'SESSION_EXPIRED', 'ACCOUNT_DISABLED'])

/**
 * The admin's only API client. The browser sends the HttpOnly avp_session
 * cookie (withCredentials); writes carry X-CSRF-Token. A 403
 * STEP_UP_REQUIRED opens the authenticator prompt and retries the same
 * request (same Idempotency-Key, so money actions can't double up).
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const csrf = getCsrf()
  if (csrf && UNSAFE.has((config.method ?? 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrf
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiError>) => {
    const config = error.config
    const data = error.response?.data
    const status = error.response?.status
    if (!error.response) {
      if (!config?.silent) toast.error('Network error: check your connection')
      return Promise.reject({ message: 'Network error', code: 'NETWORK' } satisfies ApiError)
    }
    if (status === 403 && data?.code === 'STEP_UP_REQUIRED' && config && !config._steppedUp) {
      const ok = await requestStepUp()
      if (ok) {
        config._steppedUp = true
        return api(config)
      }
      return Promise.reject(data)
    }
    if (status === 401 && data?.code && SESSION_CODES.has(data.code)) {
      setCsrf(null)
      // Silent requests (the /me probe) just report "signed out".
      if (!config?.silent) sessionExpired(errorMessage(data))
      return Promise.reject(data)
    }
    if (!config?.silent && data?.code !== 'IDEMPOTENCY_IN_PROGRESS') {
      toast.error(errorMessage(data), {
        description: data?.requestId ? `Ref ${data.requestId}` : undefined,
      })
    }
    return Promise.reject(data ?? { message: error.message })
  },
)

export default api

/** A fresh key per user action; reuse it when retrying that same action. */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
