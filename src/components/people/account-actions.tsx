import { useState } from 'react'
import { LogOut, MessageSquare, ShieldOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { useAccountAction, useMessageAccount, type AccountKind } from '@/services/people/people.api'
import { useCan } from '@/hooks/use-can'

export function AccountActions({ kind, id, suspended, openBookings }: { kind: AccountKind; id: string; suspended: boolean; openBookings: number }) {
  const { can } = useCan()
  const act = useAccountAction()
  const msg = useMessageAccount()
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | 'revoke' | 'message' | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const who = kind === 'users' ? 'user' : 'vendor'
  const requestOnly = !can('accounts.suspend') && can('accounts.request_suspend')
  const close = () => setDialog(null)

  return (
    <>
      {can('broadcasts.send') && <Button variant="outline" onClick={() => setDialog('message')}><MessageSquare /> Message</Button>}
      {can('accounts.revoke_sessions') && <Button variant="outline" onClick={() => setDialog('revoke')}><LogOut /> Sign out everywhere</Button>}
      {suspended
        ? can('accounts.suspend') && <Button variant="outline" onClick={() => setDialog('reactivate')}><ShieldCheck /> Reactivate</Button>
        : can('accounts.suspend', 'accounts.request_suspend') && <Button variant="outline" className="text-danger" onClick={() => setDialog('suspend')}><ShieldOff /> {requestOnly ? 'Request suspension' : 'Suspend'}</Button>}

      <ReasonDialog open={dialog === 'suspend'} onOpenChange={(o) => !o && close()} destructive title={requestOnly ? `Ask Operations to suspend this ${who}` : `Suspend this ${who}`}
        confirmLabel={requestOnly ? 'Send request' : 'Suspend'} pending={act.isPending}
        consequence={requestOnly ? 'Operations will review and decide.' : <>
          Every session ends at once and they can't sign in{kind === 'tenants' ? '. Their cars leave the marketplace' : ''}. New bookings are blocked.
          {openBookings > 0 && <b> {openBookings} open booking{openBookings === 1 ? '' : 's'} will need follow-up.</b>}
        </>}
        onConfirm={(reason) => act.mutateAsync({ kind, id, action: 'suspend', reason }).then(close)} />
      <ReasonDialog open={dialog === 'reactivate'} onOpenChange={(o) => !o && close()} title={`Reactivate this ${who}`} confirmLabel="Reactivate" pending={act.isPending}
        consequence={kind === 'tenants' ? 'They can sign in again. Cars return to the marketplace if the business is still verified.' : 'They can sign in and book again.'}
        onConfirm={(reason) => act.mutateAsync({ kind, id, action: 'reactivate', reason }).then(close)} />
      <ReasonDialog open={dialog === 'revoke'} onOpenChange={(o) => !o && close()} title="Sign out everywhere" confirmLabel="Sign out all devices" pending={act.isPending}
        consequence="Every device is signed out (use for a lost phone or suspected takeover). They can sign in again."
        onConfirm={(reason) => act.mutateAsync({ kind, id, action: 'revoke-sessions', reason }).then(close)} />

      <Dialog open={dialog === 'message'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Message this {who}</DialogTitle>
            <DialogDescription>Sent as an in-app and push notification from AutoVogue. Logged on the account.</DialogDescription>
          </DialogHeader>
          <Field><FieldLabel>Title</FieldLabel><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
          <Field><FieldLabel>Message</FieldLabel><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button disabled={!title.trim() || !body.trim() || msg.isPending} onClick={() => msg.mutateAsync({ kind, id, title: title.trim(), body: body.trim() }).then(() => { close(); setTitle(''); setBody('') })}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
