import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GraduationCap, KeyRound, MailPlus, ShieldCheck, ShieldOff, UserCog, UserX } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { RolePicker } from '@/components/common/role-picker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useInviteStaff, useInvites, useRevokeInvite, useRoles, useSetStaffRoles, useStaff, useStaffAction, useStaffPermissions, type StaffRow,
} from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'
import { age, dateOnly, dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/staff')({ component: Staff })

function Staff() {
  const { can, me } = useCan()
  const staff = useStaff()
  const invites = useInvites()
  const roles = useRoles()
  const invite = useInviteStaff()
  const revoke = useRevokeInvite()
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [open, setOpen] = useState<StaffRow | null>(null)

  return (
    <>
      <PageHeader eyebrow="Settings" title="Staff" description="Everyone with admin access. Changes take effect within a minute. AutoVogue always keeps at least two active super admins."
        actions={can('staff.invite') && <Button onClick={() => setInviting(true)}><MailPlus /> Invite staff</Button>} />
      <Panel flush>
        {staff.isLoading ? <Rows /> : !staff.data?.length ? <Empty title="No staff" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Roles</TableHead><TableHead>2FA</TableHead><TableHead>Training</TableHead><TableHead>Last sign-in</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.data.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpen(s)}>
                  <TableCell><p className="font-medium">{s.fullName} {s.id === me?.id && <span className="text-xs text-muted-foreground">(you)</span>}</p><p className="text-xs text-muted-foreground">{s.email}</p></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{s.roleNames.map((r) => <Pill key={r} tone="brand" dot={false}>{r}</Pill>)}</div></TableCell>
                  <TableCell>{s.twoFactorOn ? <Pill tone="success">On</Pill> : <Pill tone="warning">Not set up</Pill>}</TableCell>
                  <TableCell>{s.trainedAt ? <Pill tone="success" dot={false}>{dateOnly(s.trainedAt)}</Pill> : <Pill tone="danger">Needed to sign in</Pill>}</TableCell>
                  <TableCell className="text-xs">{s.lastLoginAt ? `${age(s.lastLoginAt)} ago` : 'Never'}</TableCell>
                  <TableCell>{s.isActive ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Deactivated</Pill>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      {!!invites.data?.length && (
        <Panel title="Open invites" className="mt-5" flush>
          <ul className="divide-y">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span><b>{i.fullName}</b> · {i.email} <span className="text-xs text-muted-foreground">expires {dateTime(i.expiresAt)}</span></span>
                {can('staff.invite') && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>Revoke</Button>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Invite a staff member</DialogTitle>
            <DialogDescription>They get an email link (valid 48 hours, single use) to set a password and an authenticator.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field><FieldLabel>Full name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field><FieldLabel>Work email</FieldLabel><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>
          <Field><FieldLabel>Roles</FieldLabel><RolePicker roles={roles.data ?? []} value={roleIds} onChange={setRoleIds} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviting(false)}>Cancel</Button>
            <Button disabled={!email || !name || roleIds.length === 0 || invite.isPending} onClick={() => invite.mutateAsync({ email: email.trim(), fullName: name.trim(), roleIds }).then(() => { setInviting(false); setEmail(''); setName(''); setRoleIds([]) })}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {open && <StaffSheet staff={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function StaffSheet({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const { can, me } = useCan()
  const perms = useStaffPermissions(staff.id)
  const roles = useRoles()
  const setRoles = useSetStaffRoles()
  const act = useStaffAction()
  const [roleIds, setRoleIds] = useState(staff.roleIds)
  const [dialog, setDialog] = useState<'roles' | 'deactivate' | 'reactivate' | 'reset-2fa' | 'training' | null>(null)
  const self = staff.id === me?.id
  const changed = [...roleIds].sort().join() !== [...staff.roleIds].sort().join()
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{staff.fullName}</SheetTitle>
          <SheetDescription>{staff.email} · joined {dateTime(staff.createdAt)}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          {!self && (
            <div className="flex flex-wrap gap-2">
              {can('staff.deactivate') && (staff.isActive
                ? <Button size="sm" variant="outline" className="text-danger" onClick={() => setDialog('deactivate')}><UserX /> Deactivate</Button>
                : <Button size="sm" variant="outline" onClick={() => setDialog('reactivate')}><ShieldCheck /> Reactivate</Button>)}
              {can('staff.reset_2fa') && staff.twoFactorOn && <Button size="sm" variant="outline" onClick={() => setDialog('reset-2fa')}><KeyRound /> Reset 2FA</Button>}
              {can('staff.update') && !staff.trainedAt && <Button size="sm" onClick={() => setDialog('training')}><GraduationCap /> Record training</Button>}
            </div>
          )}
          {can('staff.update') && !self && (
            <section className="grid gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><UserCog className="size-4" /> Roles</h3>
              <RolePicker roles={roles.data ?? []} value={roleIds} onChange={setRoleIds} />
              <Button size="sm" className="justify-self-end" disabled={!changed || roleIds.length === 0} onClick={() => setDialog('roles')}>Save roles</Button>
            </section>
          )}
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">What they can do</h3>
            {perms.isLoading ? <Rows n={4} /> : perms.data?.isSuperAdmin ? <p className="text-sm">Super admin: every permission.</p> : (
              <ul className="grid gap-1 text-xs">
                {perms.data?.grants.map((g) => (
                  <li key={g.key} className="flex justify-between gap-2 rounded bg-muted/60 px-2 py-1">
                    <span className="font-mono">{g.key}</span>
                    <span className="text-muted-foreground">{g.roles.map((r) => r.name).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <ReasonDialog open={dialog === 'roles'} onOpenChange={(o) => !o && setDialog(null)} title="Change roles" confirmLabel="Save roles" pending={setRoles.isPending}
          consequence="Their access changes within a minute, without signing them out." onConfirm={(reason) => setRoles.mutateAsync({ id: staff.id, roleIds, reason }).then(() => setDialog(null))} />
        <ReasonDialog open={dialog === 'deactivate'} onOpenChange={(o) => !o && setDialog(null)} destructive title={`Deactivate ${staff.fullName}`} confirmLabel="Deactivate" pending={act.isPending}
          consequence="Every session ends now and they can't sign in. Their audit history stays." onConfirm={(reason) => act.mutateAsync({ id: staff.id, action: 'deactivate', reason }).then(() => { setDialog(null); onClose() })} />
        <ReasonDialog open={dialog === 'reactivate'} onOpenChange={(o) => !o && setDialog(null)} title={`Reactivate ${staff.fullName}`} confirmLabel="Reactivate" pending={act.isPending}
          consequence="They can sign in again." onConfirm={(reason) => act.mutateAsync({ id: staff.id, action: 'reactivate', reason }).then(() => { setDialog(null); onClose() })} />
        <ReasonDialog open={dialog === 'training'} onOpenChange={(o) => !o && setDialog(null)} title={`Record data-protection training: ${staff.fullName}`} confirmLabel="Record training" pending={act.isPending}
          reasonLabel="Which course and when (saved in the audit log)"
          consequence="They can sign in from now on. NDPR requires staff to be trained before they handle personal data."
          onConfirm={(reason) => act.mutateAsync({ id: staff.id, action: 'training', reason }).then(() => setDialog(null))} />
        <ReasonDialog open={dialog === 'reset-2fa'} onOpenChange={(o) => !o && setDialog(null)} destructive title="Reset two-factor sign-in" confirmLabel="Reset 2FA" pending={act.isPending}
          reasonLabel="How you confirmed it's them (e.g. video call)"
          consequence={<><ShieldOff className="mr-1 inline size-4" />Their authenticator and recovery codes are removed and they are signed out. They set up a new authenticator at next sign-in.</>}
          onConfirm={(reason) => act.mutateAsync({ id: staff.id, action: 'reset-2fa', reason }).then(() => { setDialog(null); onClose() })} />
      </SheetContent>
    </Sheet>
  )
}
