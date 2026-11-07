import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

/**
 * The one dialog for every action that needs a reason (reject, suspend,
 * take down, refund, cancel, open a private file, open a chat). It says in
 * plain words what will happen, and the reason goes to the audit log.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel = 'Confirm',
  destructive,
  pending,
  children,
  canConfirm = true,
  reasonLabel = 'Reason (saved in the audit log)',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  consequence: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  pending?: boolean
  children?: React.ReactNode
  canConfirm?: boolean
  reasonLabel?: string
  onConfirm: (reason: string) => void | Promise<unknown>
}) {
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason('')
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>
        {children}
        <Field>
          <FieldLabel htmlFor="reason">{reasonLabel}</FieldLabel>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What happened and why this is the right action" autoFocus />
          <FieldDescription>5 to 500 characters. {reason.trim().length > 0 && `${reason.trim().length}/500`}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            className={destructive ? 'bg-danger text-white hover:bg-danger/90' : ''}
            disabled={!valid || !canConfirm || pending}
            onClick={async () => {
              await onConfirm(reason.trim())
              setReason('')
            }}
          >
            {pending ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
