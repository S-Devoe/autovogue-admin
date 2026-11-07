import { useInfiniteQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { newIdempotencyKey } from './axios-api'
import type { ApiError, IResponse, Paged } from './types'
import { QUERY_KEYS } from './query.keys'

/** GET returning the envelope's data. Empty params are dropped. */
export async function get<T>(url: string, params?: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== null))
  const { data } = await api.get<IResponse<T>>(url, { params: clean })
  return data.data
}

/**
 * GET where "not found" is a normal answer (a user with no wallet yet, no
 * verified identity): resolves to null without an error toast. Other errors
 * still toast.
 */
export async function getOrNull<T>(url: string, params?: Record<string, unknown>): Promise<T | null> {
  try {
    const { data } = await api.get<IResponse<T>>(url, { params, silent: true })
    return data.data
  } catch (e) {
    if ((e as ApiError)?.statusCode === 404) return null
    toast.error((e as ApiError)?.message ?? 'Something went wrong')
    throw e
  }
}

type Method = 'post' | 'put' | 'patch' | 'delete'

export interface Sent<T> {
  data: T
  message: string
  /** 202: the action is waiting for a second approver. */
  needsApproval: boolean
}

/** Write with a fresh Idempotency-Key (safe for every write; required for money). */
export async function send<T>(method: Method, url: string, body?: unknown): Promise<Sent<T>> {
  const res = await api.request<IResponse<T>>({
    method,
    url,
    data: body ?? {},
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
  return { data: res.data.data, message: res.data.message, needsApproval: res.status === 202 }
}

/**
 * useAdminMutation wraps a write: invalidates the given query key roots
 * and shows the API's message (or "sent for approval") as a toast. Errors
 * are already toasted by the API client.
 */
export function useAdminMutation<V, T = unknown>(
  fn: (vars: V) => Promise<Sent<T>>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: Sent<T>, v: V) => string | null); onSuccess?: (r: Sent<T>, v: V) => void } = {},
) {
  const qc = useQueryClient()
  return useMutation<Sent<T>, ApiError, V>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      // Audit rows are written through the queue, so refresh them a moment later.
      setTimeout(() => qc.invalidateQueries({ queryKey: [QUERY_KEYS.AUDIT] }), 1200)
      if (r.needsApproval) {
        toast.info('Sent for approval', { description: 'A second person must approve this before it happens.' })
      } else {
        const msg = typeof opts.success === 'function' ? opts.success(r, v) : (opts.success ?? r.message)
        if (msg) toast.success(msg)
      }
      opts.onSuccess?.(r, v)
    },
  })
}

/**
 * A cursor-paged admin list ({ items, nextCursor }). Read rows with
 * rowsOf(q) and put <LoadMore q={q} /> under the table.
 */
export function usePagedList<T>(
  queryKey: QueryKey,
  url: string,
  params: Record<string, unknown> = {},
  opts: { enabled?: boolean; refetchInterval?: number | false | ((q: unknown) => number | false); limit?: number } = {},
) {
  return useInfiniteQuery({
    queryKey: [...queryKey, params],
    queryFn: ({ pageParam }) => get<Paged<T>>(url, { ...params, cursor: pageParam, limit: opts.limit ?? 10 }),
    initialPageParam: '',
    getNextPageParam: (p: Paged<T>) => p.nextCursor || undefined,
    enabled: opts.enabled,
    refetchInterval: opts.refetchInterval as number | false | undefined,
  })
}

/** Every row loaded so far. */
export function rowsOf<T>(q: { data?: { pages: Paged<T>[] } }): T[] {
  return q.data?.pages.flatMap((p) => p.items) ?? []
}
