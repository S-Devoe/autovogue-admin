import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { authApi } from '@/services/auth/auth.api'
import { onStepUpRequest } from '@/services/session'
import { QUERY_KEYS } from '@/services/query.keys'
import { errorMessage } from '@/services/types'

/**
 * Sensitive actions need an authenticator code from the last 10 minutes.
 * The API client opens this when the API answers STEP_UP_REQUIRED, then
 * retries the same request once the code is accepted.
 */
export function StepUpDialog() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    onStepUpRequest((resolve) => {
      resolver.current = resolve
      setCode('')
      setError('')
      setOpen(true)
    })
    return () => onStepUpRequest(null)
  }, [])

  const finish = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpen(false)
  }

  const submit = async (value: string) => {
    setBusy(true)
    setError('')
    try {
      await authApi.stepUp(value)
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.ME] })
      finish(true)
    } catch (e) {
      setError(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-full bg-info-soft text-info">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle className="font-display text-lg">Confirm it's you</DialogTitle>
          <DialogDescription>Enter the 6-digit code from your authenticator app. You won't be asked again for 10 minutes.</DialogDescription>
        </DialogHeader>
        <div className="grid justify-center gap-2 py-2">
          <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={submit} disabled={busy} autoFocus>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-center text-xs text-danger">{error}</p>}
          {busy && <p className="text-center text-xs text-muted-foreground">Checking...</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
