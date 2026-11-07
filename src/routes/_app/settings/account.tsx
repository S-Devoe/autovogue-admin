import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { LogOut, Monitor } from 'lucide-react'
import { KV, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useChangePassword, useMySessions, useRevokeOtherSessions } from '@/services/auth/auth.api'
import { useCan } from '@/hooks/use-can'
import { age, dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/account')({ component: Account })

function Account() {
  const { me } = useCan()
  const sessions = useMySessions()
  const revoke = useRevokeOtherSessions()
  const change = useChangePassword()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  return (
    <>
      <PageHeader eyebrow="Settings" title="My account" description="Your sign-in, sessions and permissions." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Profile">
          <KV items={[
            ['Name', me?.fullName], ['Email', me?.email],
            ['Roles', me?.roles.map((r) => r.name).join(', ')], ['Permissions', me?.isSuperAdmin ? 'All (super admin)' : me?.permissions.length],
            ['Session ends', dateTime(me?.sessionExpiresAt)], ['Idle sign-out', `${Math.round((me?.idleTimeoutSeconds ?? 0) / 60)} minutes`],
          ]} />
        </Panel>
        <Panel title="Change password" description="Your other sessions are signed out.">
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); change.mutateAsync({ currentPassword: cur, newPassword: next }).then(() => { setCur(''); setNext('') }) }}>
            <Field><FieldLabel>Current password</FieldLabel><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
            <Field><FieldLabel>New password</FieldLabel><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} /><FieldDescription>At least 12 characters.</FieldDescription></Field>
            <Button type="submit" className="justify-self-start" disabled={!cur || next.length < 12 || change.isPending}>Change password</Button>
          </form>
        </Panel>
        <Panel title="Active sessions" className="xl:col-span-2" actions={<Button size="sm" variant="outline" onClick={() => revoke.mutate()} disabled={revoke.isPending}><LogOut /> Sign out other devices</Button>} flush>
          {sessions.isLoading ? <Rows /> : (
            <ul className="divide-y">
              {sessions.data?.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Monitor className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{s.userAgent || 'Unknown browser'}</p>
                    <p className="text-xs text-muted-foreground">{s.ip} · signed in {dateTime(s.createdAt)} · active {age(s.lastSeenAt)} ago</p>
                  </div>
                  {s.current && <Pill tone="success">This device</Pill>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
