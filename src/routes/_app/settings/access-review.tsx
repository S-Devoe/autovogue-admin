import { useState } from 'react'
import { Download } from 'lucide-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Empty, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, useAccessReview, useDecideAccessReview, type AccessReviewRow } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { useCan } from '@/hooks/use-can'
import { dateOnly, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/access-review')({ component: AccessReview })

function quarterLabel(d = new Date()) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
}

/** PRD STF-7: once a quarter a super admin confirms each person still needs what they have. */
function AccessReview() {
  const { can } = useCan()
  const q = useAccessReview(can('roles.manage'))
  const decide = useDecideAccessReview()
  const [open, setOpen] = useState<{ row: AccessReviewRow; decision: 'confirm' | 'change' } | null>(null)
  const [note, setNote] = useState('')
  const done = q.data?.filter((r) => r.decision).length ?? 0

  return (
    <>
      <PageHeader eyebrow="Settings" title={`Access review, ${quarterLabel()}`}
        description="Check that each person still needs every permission they hold. Confirming records the exact permission list in the audit trail. To change access, mark it here and then edit their roles in Staff."
        actions={q.data && <>
          <Pill tone={done === q.data.length ? 'success' : 'warning'}>{done} of {q.data.length} reviewed</Pill>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(API_ENDPOINTS.ACCESS_REVIEW, { format: 'csv' }, `access-review-${quarterLabel().replace(' ', '-')}.csv`)}><Download /> Export CSV</Button>
        </>} />
      <Panel flush>
        {q.isLoading ? <Rows /> : !q.data?.length ? <Empty title="No staff" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Roles</TableHead><TableHead>Permissions</TableHead><TableHead>This quarter</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.staff.id} className={!r.staff.isActive ? 'opacity-60' : undefined}>
                  <TableCell><p className="font-medium">{r.staff.fullName}</p><p className="text-xs text-muted-foreground">{r.staff.email}</p></TableCell>
                  <TableCell className="text-xs">{r.staff.roleNames?.join(', ') || '-'}</TableCell>
                  <TableCell className="max-w-md">
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">{r.permissions.length} permissions</summary>
                      <p className="mt-1 font-mono text-[11px] leading-5">{r.permissions.join(', ')}</p>
                    </details>
                  </TableCell>
                  <TableCell>
                    {r.decision ? <Pill tone={r.decision === 'confirm' ? 'success' : 'warning'}>{r.decision === 'confirm' ? 'Confirmed' : 'Needs change'} {dateOnly(r.reviewedAt)}</Pill> : <Pill>Not reviewed</Pill>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setNote(''); setOpen({ row: r, decision: 'change' }) }}>Needs change</Button>
                      <Button size="sm" onClick={() => { setNote(''); setOpen({ row: r, decision: 'confirm' }) }}>Confirm</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.decision === 'confirm' ? 'Confirm access' : 'Mark for change'}: {open?.row.staff.fullName}</DialogTitle>
            <DialogDescription>
              {open?.decision === 'confirm'
                ? `Records that ${open?.row.permissions.length} permissions are still needed.`
                : <>Records that this person's access should change. Then <Link to="/settings/staff" className="underline">edit their roles</Link>.</>}
            </DialogDescription>
          </DialogHeader>
          <Field><FieldLabel>Note (optional)</FieldLabel><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button disabled={decide.isPending} onClick={() => open && decide.mutateAsync({ staffId: open.row.staff.id, decision: open.decision, note }).then(() => setOpen(null))}>
              {titleCase(open?.decision === 'confirm' ? 'confirm' : 'record')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
