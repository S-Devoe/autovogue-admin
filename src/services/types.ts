/** API envelope: { message, statusCode, success, data }. */
export interface IResponse<T> {
  message: string
  statusCode: number
  success: boolean
  data: T
}

/** Error body; admin errors carry a stable `code` and the `requestId`. */
export interface ApiError {
  message: string | string[]
  statusCode?: number
  success?: false
  code?: string
  requestId?: string
}

/** Cursor-paged list. */
export interface Paged<T> {
  items: T[]
  nextCursor?: string
}

export const errorMessage = (e: unknown): string => {
  const err = e as ApiError | undefined
  if (!err) return 'Something went wrong'
  if (Array.isArray(err.message)) return err.message[0] ?? 'Something went wrong'
  return err.message || 'Something went wrong'
}
