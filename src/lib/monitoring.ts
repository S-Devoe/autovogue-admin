import * as Sentry from '@sentry/react'
import { APP_ENV } from './env'

/**
 * Error reporting (PRD 10: "Admin JS errors"). Off unless VITE_SENTRY_DSN is
 * set at build time. Nothing personal leaves the browser: no cookies,
 * headers, query strings, user details or request bodies, and text that
 * looks like an email, phone or account number is masked.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
const DIGITS = /\b\d{7,}\b/g // phone and account numbers

export function scrub(text?: string) {
  return text?.replace(EMAIL, '[email]').replace(DIGITS, '[number]')
}

function stripQuery(url?: string) {
  return url?.split('?')[0]
}

export function initMonitoring() {
  if (!DSN) return
  Sentry.init({
    dsn: DSN,
    environment: APP_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
        delete event.request.data
        event.request.url = stripQuery(event.request.url)
        delete event.request.query_string
      }
      event.message = scrub(event.message)
      for (const ex of event.exception?.values ?? []) ex.value = scrub(ex.value)
      return event
    },
    beforeBreadcrumb(b) {
      if (b.category === 'console') return null
      if (b.data?.url) b.data.url = stripQuery(String(b.data.url))
      if (b.data?.from) b.data.from = stripQuery(String(b.data.from))
      if (b.data?.to) b.data.to = stripQuery(String(b.data.to))
      b.message = scrub(b.message)
      return b
    },
  })
}
