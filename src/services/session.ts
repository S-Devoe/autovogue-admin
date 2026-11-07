/**
 * In-memory session bits shared by the API client and the UI. Nothing here
 * is a credential: the session itself is an HttpOnly cookie the browser
 * sends; the CSRF token is echoed on writes and comes from /auth/platform/me.
 */
let csrfToken: string | null = null
export const getCsrf = () => csrfToken
export const setCsrf = (t: string | null) => {
  csrfToken = t
}

type StepUpListener = (resolve: (ok: boolean) => void) => void
let stepUpListener: StepUpListener | null = null
let pending: Promise<boolean> | null = null

/** The step-up dialog registers itself here (components/auth/step-up-dialog). */
export function onStepUpRequest(l: StepUpListener | null) {
  stepUpListener = l
}

/** Ask for a fresh authenticator code. Resolves true once step-up succeeded. */
export function requestStepUp(): Promise<boolean> {
  if (!stepUpListener) return Promise.resolve(false)
  if (!pending) {
    pending = new Promise<boolean>((resolve) => stepUpListener!(resolve)).finally(() => {
      pending = null
    })
  }
  return pending
}

type ExpiredListener = (reason: string) => void
let expiredListener: ExpiredListener | null = null
export const onSessionExpired = (l: ExpiredListener | null) => {
  expiredListener = l
}
export const sessionExpired = (reason: string) => expiredListener?.(reason)
