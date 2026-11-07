import { setupServer } from 'msw/node'
import { API_BASE_URL } from '@/lib/env'

/** MSW server for component tests; add handlers per test with server.use(). */
export const server = setupServer()
export const api = (path: string) => `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
export const ok = <T,>(data: T) => ({ message: 'success', statusCode: 200, success: true, data })
