import { createFileRoute } from '@tanstack/react-router'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInviteWaitlist, useWaitlist } from '@/services/people/people.api'
import { Button } from '@/components/ui/button'
import { useCan } from '@/hooks/use-can'
import { dateOnly, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/people/waitlist')({ component: Waitlist })

function Waitlist() {
  const q = useWaitlist()
  const { rows: qRows, pager: qPager } = usePager(q)
  const invite = useInviteWaitlist()
  const { can } = useCan()
  return (
    <>
      <PageHeader eyebrow="People" title="Vendor waitlist" description="People who asked to list cars from the landing page. Phone numbers are masked." />
      <Panel flush>
        {q.isLoading ? <Rows /> : !qRows.length ? <Empty title="No one on the waitlist" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Business</TableHead><TableHead>Cars</TableHead><TableHead>Heard via</TableHead><TableHead>Joined</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {qRows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell>{w.email}</TableCell>
                  <TableCell className="font-mono text-xs">{w.phoneNumber}</TableCell>
                  <TableCell>{titleCase(w.businessType)}</TableCell>
                  <TableCell>{w.numberOfCars}</TableCell>
                  <TableCell className="text-xs">{w.howDidYouHear}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateOnly(w.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {(w as { invitedAt?: string | null }).invitedAt ? <span className="text-xs text-success">Invited {dateOnly((w as { invitedAt?: string }).invitedAt)}</span>
                      : can('broadcasts.send') && <Button size="sm" variant="outline" onClick={() => invite.mutate(w.id)} disabled={invite.isPending}>Invite to register</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
    </>
  )
}
