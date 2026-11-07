import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDecideNameChange, useNameChanges, type NameChange } from '@/services/verification/verification.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/verification/name-changes')({ component: NameChanges })

function NameChanges() {
  const [status, setStatus] = useState('pending')
  const q = useNameChanges(status)
  const { rows: qRows, pager: qPager } = usePager(q)
  const decide = useDecideNameChange()
  const { can } = useCan()
  const [open, setOpen] = useState<{ row: NameChange; approve: boolean } | null>(null)

  return (
    <>
      <PageHeader eyebrow="Verification" title="Name changes"
        description="Verified users can't edit their name in the app; they ask here. Approve only when the new name matches the verified legal name (for example after marriage, with a fresh identity check)."
        actions={
          <NativeSelect aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <NativeSelectOption value="pending">Pending</NativeSelectOption>
            <NativeSelectOption value="approved">Approved</NativeSelectOption>
            <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
          </NativeSelect>
        } />
      <Panel flush>
        {q.isLoading ? <Rows /> : !qRows.length ? <Empty title={`No ${status} requests`} /> : (
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Current name</TableHead><TableHead>Asked for</TableHead><TableHead>Verified legal name</TableHead><TableHead>Note</TableHead><TableHead>Asked</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {qRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.email}</TableCell>
                  <TableCell>{r.currentFirstName} {r.currentLastName}</TableCell>
                  <TableCell className="font-medium">{r.firstName} {r.lastName}</TableCell>
                  <TableCell>
                    {r.verifiedLegalName || '-'}
                    <div className="mt-1">{r.matches ? <Pill tone="success">Matches</Pill> : <Pill tone="warning">Differs</Pill>}</div>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{r.note ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateTime(r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === 'pending' && can('verifications.decide') ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOpen({ row: r, approve: false })}>Reject</Button>
                        <Button size="sm" onClick={() => setOpen({ row: r, approve: true })}>Approve</Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">{titleCase(r.status)}{r.decisionNote ? `: ${r.decisionNote}` : ''}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
      <ReasonDialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} pending={decide.isPending}
        title={open?.approve ? 'Approve name change' : 'Reject name change'}
        confirmLabel={open?.approve ? 'Approve' : 'Reject'} destructive={!open?.approve}
        reasonLabel="Note for the user (also saved in the audit log)"
        consequence={open?.approve
          ? <>The user's name becomes <b>{open.row.firstName} {open.row.lastName}</b> everywhere in AutoVogue. {!open.row.matches && 'It does not match the verified legal name, so be sure you have seen proof.'}</>
          : 'The user keeps their current name and sees your note.'}
        onConfirm={(note) => void (open && decide.mutateAsync({ id: open.row.id, approve: open.approve, note }).then(() => setOpen(null)))} />
    </>
  )
}
