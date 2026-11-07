import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { AuthLayout } from '@/components/auth/auth-layout'
import { RecoveryCodes, TwoFactorStep } from '@/components/auth/two-factor'
import { authApi, useStoreSession, type Challenge } from '@/services/auth/auth.api'
import { QUERY_KEYS } from '@/services/query.keys'
import { errorMessage } from '@/services/types'

export const Route = createFileRoute('/accept-invite')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === 'string' ? s.token : undefined }),
  component: AcceptInvite,
})

function AcceptInvite() {
  const { token = '' } = Route.useSearch()
  const navigate = useNavigate()
  const store = useStoreSession()
  const invite = useQuery({ queryKey: [QUERY_KEYS.INVITE, token], queryFn: () => authApi.invite(token), retry: false, enabled: !!token })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (codes) return <AuthLayout title="Save your recovery codes"><RecoveryCodes codes={codes} onContinue={() => navigate({ to: '/' })} /></AuthLayout>
  if (challenge) {
    return (
      <AuthLayout title="Set up two-factor sign-in" subtitle="Last step: connect an authenticator app.">
        <TwoFactorStep challenge={challenge} onDone={(s) => { store(s.me); setCodes(s.recoveryCodes ?? []) }} onRestart={() => navigate({ to: '/login' })} />
      </AuthLayout>
    )
  }
  if (!token || invite.isError) {
    return <AuthLayout title="Invite link not valid" subtitle="It may have expired (links last 48 hours) or been used. Ask a super admin for a new one." >{null}</AuthLayout>
  }
  return (
    <AuthLayout title={invite.data ? `Welcome, ${invite.data.fullName.split(' ')[0]}` : 'Accept your invite'} subtitle={invite.data && <>Create a password for <b>{invite.data.email}</b>.</>}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (pw !== pw2) return setError("The passwords don't match")
          setBusy(true)
          setError('')
          try {
            setChallenge(await authApi.acceptInvite(token, pw))
          } catch (err) {
            setError(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field>
          <FieldLabel htmlFor="pw">New password</FieldLabel>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10" required minLength={12} />
          <FieldDescription>At least 12 characters. Passwords found in known data breaches are refused.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="pw2">Repeat password</FieldLabel>
          <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-10" required />
        </Field>
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="h-10" disabled={busy || !invite.data}>{busy ? 'Saving...' : 'Continue'}</Button>
      </form>
    </AuthLayout>
  )
}
