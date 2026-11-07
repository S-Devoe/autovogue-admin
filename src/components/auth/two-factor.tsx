import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Download, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { authApi, type Challenge, type SessionStart } from '@/services/auth/auth.api'
import { errorMessage } from '@/services/types'

export function CodeBoxes({ value, onChange, onComplete, disabled }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean }) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange} onComplete={onComplete} disabled={disabled} autoFocus>
      <InputOTPGroup>
        <InputOTPSlot index={0} className="size-11 text-lg" />
        <InputOTPSlot index={1} className="size-11 text-lg" />
        <InputOTPSlot index={2} className="size-11 text-lg" />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} className="size-11 text-lg" />
        <InputOTPSlot index={4} className="size-11 text-lg" />
        <InputOTPSlot index={5} className="size-11 text-lg" />
      </InputOTPGroup>
    </InputOTP>
  )
}

/** Second factor after the password: set up an authenticator, or enter its code. */
export function TwoFactorStep({ challenge, onDone, onRestart }: { challenge: Challenge; onDone: (s: SessionStart) => void; onRestart: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (challenge.next !== 'setup') return
    authApi.setup(challenge.challengeToken).then(setSetup).catch((e) => setError(errorMessage(e)))
  }, [challenge])

  const run = async (fn: () => Promise<SessionStart>) => {
    setBusy(true)
    setError('')
    try {
      onDone(await fn())
    } catch (e) {
      const err = e as { code?: string }
      if (err.code === 'CHALLENGE_EXPIRED') return onRestart()
      setError(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  if (recovery !== null) {
    return (
      <div className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="rc">Recovery code</FieldLabel>
          <Input id="rc" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="abcde-fghij" className="h-10 font-mono" autoFocus />
          <FieldDescription>Each recovery code works once.</FieldDescription>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button size="lg" disabled={busy || recovery.trim().length < 10} onClick={() => run(() => authApi.recovery(challenge.challengeToken, recovery.trim()))}>
          Sign in
        </Button>
        <Button variant="link" onClick={() => setRecovery(null)}>Use my authenticator instead</Button>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {challenge.next === 'setup' && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">1. Scan with your authenticator app</p>
          <p className="text-xs text-muted-foreground">Google Authenticator, 1Password, Authy or Microsoft Authenticator. SMS codes are not supported.</p>
          <div className="grid place-items-center rounded-lg bg-white p-3">
            {setup ? <QRCodeSVG value={setup.otpauthUri} size={168} level="M" /> : <div className="size-[168px] animate-pulse rounded bg-muted" />}
          </div>
          {setup && (
            <button
              type="button"
              className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-left font-mono text-[11px] break-all"
              onClick={() => {
                navigator.clipboard.writeText(setup.secret)
                setCopied(true)
              }}
            >
              {setup.secret}
              {copied ? <Check className="size-3.5 shrink-0 text-success" /> : <Copy className="size-3.5 shrink-0" />}
            </button>
          )}
          <p className="text-sm font-semibold">2. Enter the 6-digit code it shows</p>
        </div>
      )}
      <div className="grid justify-center gap-2">
        <CodeBoxes value={code} onChange={setCode} disabled={busy} onComplete={(v) => run(() => authApi.verify(challenge.challengeToken, v))} />
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        {busy && <p className="text-center text-xs text-muted-foreground">Checking...</p>}
      </div>
      {challenge.next === 'verify' && (
        <Button variant="link" onClick={() => setRecovery('')}>
          <KeyRound /> Lost your phone? Use a recovery code
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onRestart}>Start again</Button>
    </div>
  )
}

/** Shown once after enrolment. */
export function RecoveryCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = useState(false)
  const download = () => {
    const blob = new Blob([`AutoVogue Admin recovery codes\nEach code works once. Keep them in the company password manager.\n\n${codes.join('\n')}\n`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'autovogue-admin-recovery-codes.txt'
    a.click()
  }
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
        These 10 codes let you sign in if you lose your phone. They are shown only now. Store them in the company password manager.
      </div>
      <ol className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded bg-muted px-2 py-1 text-center">{c}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigator.clipboard.writeText(codes.join('\n'))}><Copy /> Copy</Button>
        <Button variant="outline" className="flex-1" onClick={download}><Download /> Download</Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        I have stored my recovery codes safely
      </label>
      <Button size="lg" disabled={!saved} onClick={onContinue}>Continue to the admin</Button>
    </div>
  )
}
