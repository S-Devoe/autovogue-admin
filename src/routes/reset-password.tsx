import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { AuthLayout } from '@/components/auth/auth-layout'
import { authApi } from '@/services/auth/auth.api'
import { errorMessage } from '@/services/types'

export const Route = createFileRoute('/reset-password')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === 'string' ? s.token : undefined }),
  component: Reset,
})

function Reset() {
  const { token = '' } = Route.useSearch()
  const [pw, setPw] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (done) return <AuthLayout title="Password updated" subtitle="Every session was signed out."><Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></AuthLayout>
  return (
    <AuthLayout title="Choose a new password">
      <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await authApi.resetPassword(token, pw); setDone(true) } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) } }}>
        <Field>
          <FieldLabel htmlFor="pw">New password</FieldLabel>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={12} className="h-10" autoFocus />
          <FieldDescription>At least 12 characters, not found in known breaches.</FieldDescription>
        </Field>
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="h-10" disabled={busy || !token}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
