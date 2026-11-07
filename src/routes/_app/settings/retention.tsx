import { createFileRoute } from '@tanstack/react-router'
import { PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useHealth } from '@/services/overview/overview.api'

export const Route = createFileRoute('/_app/settings/retention')({ component: Retention })

/**
 * AUD-4: how long AutoVogue keeps personal data. The numbers come from the
 * API's own settings (the same ones the jobs use), not from this page.
 */
function Retention() {
  const q = useHealth()
  const r = q.data?.retention
  if (q.isLoading || !r) return <Rows />
  const rows: [string, string, string, React.ReactNode][] = [
    ['Identity document images (ID card, passport, licence, CAC)', `${r.idImageDays} days after the review decision`,
      `Deleted from the private R2 bucket by a job every ${r.purgeEveryHours} hours. Each review screen shows the deletion date and when it actually happened.`,
      r.purgerRunning ? <Pill tone="success">Job running</Pill> : <Pill tone="danger">Job off: R2 not configured</Pill>],
    ['ID numbers sent to Prembly while a check is pending', `${r.pendingIdMaxHours} hours at most`,
      'Kept encrypted only while Prembly retries, then deleted whether or not the check finished. ID numbers are never stored after that.',
      <Pill tone="success">Enforced</Pill>],
    ['ID numbers, dates of birth, RC numbers, hashes of them', 'Never stored', 'Only the match result and the verified legal name are kept (NDPR data minimisation).', <Pill tone="success">Enforced</Pill>],
    ['Verified legal name', 'For the life of the account', 'Needed to check that payout and withdrawal accounts belong to the person. Visible to admins only. Anonymised on erasure.', <Pill>Account life</Pill>],
    ['Admin audit log', `At least ${r.auditLogMinYears} years`, 'Append-only: the database rejects edits and deletes. The app never removes old months.', <Pill tone="success">Enforced</Pill>],
    ['Financial records (payments, refunds, payouts, ledger)', 'Kept as the law requires', 'Not removed by an erasure request; the person is anonymised instead.', <Pill>Legal hold</Pill>],
  ]
  return (
    <>
      <PageHeader eyebrow="Settings" title="Data retention" description="How long AutoVogue keeps personal data, read from the settings the background jobs actually use." />
      <Panel flush>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Kept for</TableHead><TableHead>How</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map(([what, howLong, how, status]) => (
              <TableRow key={what}>
                <TableCell className="max-w-64 font-medium whitespace-normal">{what}</TableCell>
                <TableCell className="whitespace-nowrap">{howLong}</TableCell>
                <TableCell className="max-w-md text-xs whitespace-normal text-muted-foreground">{how}</TableCell>
                <TableCell className="text-right">{status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  )
}
