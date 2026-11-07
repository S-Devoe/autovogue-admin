import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { Empty, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useKycPending, useRetryKyc } from '@/services/verification/verification.api'
import { useCan } from '@/hooks/use-can'
import { age, dateTime, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/verification/pending-checks')({ component: Pending })

function Pending() {
  const { can } = useCan()
  const q = useKycPending()
  const { rows: qRows, pager: qPager } = usePager(q)
  const retry = useRetryKyc()
  return (
    <>
      <PageHeader eyebrow="Verification" title="Waiting on Prembly" description="Lookups Prembly couldn't answer yet. They retry on their own (1m, 5m, 15m, 1h ... 24h). The encrypted ID number is deleted when the check ends." />
      <Panel flush>
        {q.isLoading ? <Rows /> : !qRows.length ? <Empty title="No checks waiting" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Who</TableHead><TableHead>Attempts</TableHead><TableHead>Last error</TableHead><TableHead>Next retry</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {qRows.map((c) => (
                <TableRow key={c.documentId}>
                  <TableCell>{titleCase(c.documentType)}<p className="text-xs text-muted-foreground">waiting {age(c.createdAt)}</p></TableCell>
                  <TableCell>{titleCase(c.subjectType)} <Mono className="text-muted-foreground">{c.subjectId.slice(-8)}</Mono></TableCell>
                  <TableCell className="tabular">{c.attempts ?? 0}</TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{c.lastError ?? '-'}</TableCell>
                  <TableCell className="text-xs">{dateTime(c.nextAttemptAt)}</TableCell>
                  <TableCell className="text-right">
                    {can('kyc_checks.retry') && <Button size="sm" variant="outline" onClick={() => retry.mutate(c.documentId)} disabled={retry.isPending}><RefreshCw /> Retry now</Button>}
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
