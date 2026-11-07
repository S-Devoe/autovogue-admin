import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { AuthLayout } from '@/components/auth/auth-layout'
import { RecoveryCodes, TwoFactorStep } from '@/components/auth/two-factor'
import { authApi, useStoreSession, type Challenge, type SessionStart } from '@/services/auth/auth.api'
import { errorMessage } from '@/services/types'

export const Route = createFileRoute('/login')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined }),
  component: Login,
})

function Login() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const store = useStoreSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const enter = () => {
    const to = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
    navigate({ to })
  }
  const done = (s: SessionStart) => {
    store(s.me)
    if (s.recoveryCodes?.length) setCodes(s.recoveryCodes)
    else enter()
  }

  if (codes) {
    return (
      <AuthLayout title="Save your recovery codes" subtitle="Two-factor sign-in is now on for your account.">
        <RecoveryCodes codes={codes} onContinue={enter} />
      </AuthLayout>
    )
  }

  if (challenge) {
    return (
      <AuthLayout
        title={challenge.next === 'setup' ? 'Set up two-factor sign-in' : 'Enter your code'}
        subtitle={challenge.next === 'setup' ? 'Every staff account needs an authenticator app.' : 'Open your authenticator app for AutoVogue Admin.'}
      >
        <TwoFactorStep challenge={challenge} onDone={done} onRestart={() => setChallenge(null)} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Staff sign in" subtitle="Use your AutoVogue staff email.">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            setChallenge(await authApi.login(email.trim(), password))
            setPassword('')
          } catch (err) {
            setError(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" autoFocus />
        </Field>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
        </Field>
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="h-10" disabled={busy}>{busy ? 'Checking...' : 'Continue'}</Button>
        <p className="text-center text-xs text-muted-foreground">No account? A super admin has to invite you.</p>
      </form>
    </AuthLayout>
  )
}
