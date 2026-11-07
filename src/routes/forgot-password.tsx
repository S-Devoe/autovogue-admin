import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { AuthLayout } from '@/components/auth/auth-layout'
import { authApi } from '@/services/auth/auth.api'

export const Route = createFileRoute('/forgot-password')({ ssr: false, component: Forgot })

function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <AuthLayout title="Reset your password" subtitle={sent ? undefined : "We'll email you a link that works for 1 hour."}>
      {sent ? (
        <div className="grid gap-4 text-sm">
          <p>If <b>{email}</b> belongs to a staff account, a reset link is on its way. You'll still need your authenticator code to sign in.</p>
          <Link to="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await authApi.requestReset(email.trim()) } finally { setBusy(false); setSent(true) } }}>
          <Field>
            <FieldLabel htmlFor="email">Staff email</FieldLabel>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" autoFocus />
          </Field>
          <Button type="submit" size="lg" className="h-10" disabled={busy}>Send reset link</Button>
          <Link to="/login" className="text-center text-xs text-muted-foreground hover:text-foreground">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  )
}
