import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, Play } from 'lucide-react'
import { Empty, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMismatches, useReconRuns, useResolveMismatch, useRunRecon, type Mismatch } from '@/services/money/money.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, shortId, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/money/reconciliation')({ component: Reconciliation })

function Reconciliation() {
  const { can } = useCan()
  const runs = useReconRuns()
  const { rows: runsRows, pager: runsPager } = usePager(runs)
  const [all, setAll] = useState(false)
  const mism = useMismatches(all)
  const { rows: mismRows, pager: mismPager } = usePager(mism)
  const run = useRunRecon()
  const resolve = useResolveMismatch()
  const [target, setTarget] = useState<Mismatch | null>(null)
  const running = runsRows.some((r) => r.status === 'running')

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Reconciliation"
        description="Checks that every booking's ledger balances against what Paystack moved. Runs nightly at 02:00 WAT; run it now after an outage."
        actions={can('reconciliation.run') && <Button onClick={() => run.mutate()} disabled={run.isPending || running}><Play /> {running ? 'Running...' : 'Run now'}</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Mismatches" description="Close each one with a note explaining what you found." actions={<label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={all} onCheckedChange={setAll} /> Include resolved</label>} flush>
          {mism.isLoading ? <Rows /> : !mismRows.length ? <Empty title="No open mismatches" icon={<CheckCircle2 className="size-5 text-success" />} /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Found</TableHead><TableHead>Booking</TableHead><TableHead>Kind</TableHead><TableHead>Detail</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {mismRows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{dateTime(m.createdAt)}</TableCell>
                    <TableCell>{m.bookingId ? <Link to="/bookings/$id" params={{ id: m.bookingId }} className="hover:underline"><Mono>{shortId(m.bookingId)}</Mono></Link> : '-'}</TableCell>
                    <TableCell>{titleCase(m.kind)}</TableCell>
                    <TableCell className="max-w-72 text-xs text-muted-foreground">{m.detail}{m.resolutionNote && <p className="mt-1 text-success">Resolved by {m.resolvedByName}: {m.resolutionNote}</p>}</TableCell>
                    <TableCell className="text-right">{!m.resolvedAt && can('reconciliation.resolve') && <Button size="sm" variant="outline" onClick={() => setTarget(m)}>Resolve</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {mismPager}
        </Panel>
        <Panel title="Runs" flush>
          {runs.isLoading ? <Rows /> : !runsRows.length ? <Empty title="No runs yet" /> : (
            <ul className="divide-y">
              {runsRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{dateTime(r.startedAt)}</p>
                    <p className="text-xs text-muted-foreground">{r.triggeredByName ?? 'Nightly schedule'} · {r.checkedCount} bookings checked{r.error && ` · ${r.error}`}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill value={r.status === 'succeeded' ? 'verified' : r.status === 'running' ? 'sending' : 'failed'} label={titleCase(r.status)} />
                    <p className="mt-1 text-xs tabular">{r.mismatchCount} mismatch{r.mismatchCount === 1 ? '' : 'es'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {runsPager}
        </Panel>
      </div>
      <ReasonDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title="Resolve mismatch" reasonLabel="What you found and did" confirmLabel="Mark resolved" pending={resolve.isPending}
        consequence="The mismatch closes with your note. If money is actually missing, escalate to engineering before resolving."
        onConfirm={(reason) => resolve.mutateAsync({ id: target!.id, reason }).then(() => setTarget(null))} />
    </>
  )
}
