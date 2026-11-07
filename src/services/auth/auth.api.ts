import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../axios-api'
import { API_ENDPOINTS } from '../api-endpoints'
import { QUERY_KEYS } from '../query.keys'
import { get, send, useAdminMutation } from '../request'
import { setCsrf } from '../session'
import type { IResponse } from '../types'

export interface Grant {
  key: string
  roles: { id: string; name: string }[]
}

export interface Me {
  id: string
  email: string
  fullName: string
  roles: { id: string; name: string }[]
  permissions: string[]
  grants: Grant[]
  isSuperAdmin: boolean
  csrfToken: string
  sessionId: string
  sessionExpiresAt: string
  idleTimeoutSeconds: number
  stepUpAt: string
  stepUpWindowSeconds: number
  environment: string
  lastLoginAt?: string
}

export interface Challenge {
  challengeToken: string
  next: 'verify' | 'setup'
  expiresAt: string
}

export interface SessionStart {
  me: Me
  recoveryCodes?: string[]
}

/** Loads the signed-in staff member (null when signed out). */
export async function fetchMe(): Promise<Me | null> {
  try {
    const { data } = await api.get<IResponse<Me>>(API_ENDPOINTS.ME, { silent: true })
    setCsrf(data.data.csrfToken)
    return data.data
  } catch {
    setCsrf(null)
    return null
  }
}

export const meQueryOptions = {
  queryKey: [QUERY_KEYS.ME],
  queryFn: fetchMe,
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
}

export const useMe = () => useQuery(meQueryOptions)

async function post<T>(url: string, body: unknown) {
  const { data } = await api.post<IResponse<T>>(url, body, { silent: true })
  return data.data
}

export const authApi = {
  login: (email: string, password: string) => post<Challenge>(API_ENDPOINTS.LOGIN, { email, password }),
  setup: (challengeToken: string) => post<{ secret: string; otpauthUri: string }>(API_ENDPOINTS.TOTP_SETUP, { challengeToken }),
  verify: (challengeToken: string, code: string) => post<SessionStart>(API_ENDPOINTS.TOTP_VERIFY, { challengeToken, code }),
  recovery: (challengeToken: string, recoveryCode: string) => post<SessionStart>(API_ENDPOINTS.TOTP_RECOVERY, { challengeToken, recoveryCode }),
  stepUp: (code: string) => post<{ stepUpAt: string }>(API_ENDPOINTS.STEP_UP, { code }),
  invite: (token: string) => get<{ email: string; fullName: string; expiresAt: string }>(API_ENDPOINTS.INVITE, { token }),
  acceptInvite: (token: string, password: string) => post<Challenge>(API_ENDPOINTS.ACCEPT_INVITE, { token, password }),
  requestReset: (email: string) => post<unknown>(API_ENDPOINTS.REQUEST_RESET, { email }),
  resetPassword: (token: string, newPassword: string) => post<unknown>(API_ENDPOINTS.RESET_PASSWORD, { token, newPassword }),
  logout: async () => {
    try {
      await api.post(API_ENDPOINTS.LOGOUT, {}, { silent: true })
    } finally {
      setCsrf(null)
    }
  },
}

export interface SessionView {
  id: string
  ip: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export const useMySessions = () =>
  useQuery({ queryKey: [QUERY_KEYS.MY_SESSIONS], queryFn: () => get<SessionView[]>(API_ENDPOINTS.SESSIONS) })

export const useRevokeOtherSessions = () =>
  useAdminMutation(() => send('post', API_ENDPOINTS.REVOKE_OTHER_SESSIONS), { invalidate: [[QUERY_KEYS.MY_SESSIONS]] })

export const useChangePassword = () =>
  useAdminMutation((v: { currentPassword: string; newPassword: string }) => send('post', API_ENDPOINTS.CHANGE_PASSWORD, v), {
    invalidate: [[QUERY_KEYS.MY_SESSIONS]],
    success: 'Password changed. Your other sessions were signed out',
  })

/** Put a freshly started session into the cache. */
export function useStoreSession() {
  const qc = useQueryClient()
  return (me: Me) => {
    setCsrf(me.csrfToken)
    qc.setQueryData([QUERY_KEYS.ME], me)
  }
}
