import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Hand, PlayCircle, RotateCw } from 'lucide-react'
import { Empty, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePayoutStats, type PayoutStats } from '@/services/stats.api'
import { StatCards } from '@/components/common/stat-cards'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePayoutAction, usePayouts, type PayoutRow } from '@/services/money/money.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, shortId } from '@/lib/format'

const VIEWS = {
  due: { label: 'Due now', f: { view: 'due' } },
  failed: { label: 'Failed', f: { state: 'FAILED' } },
  held: { label: 'On hold', f: { view: 'held' } },
  releasing: { label: 'Sending', f: { state: 'RELEASING' } },
  released: { label: 'Paid', f: { state: 'RELEASED' } },
  all: { label: 'All', f: {} },
} as const
type View = keyof typeof VIEWS

/** Which count belongs to each tab. */
const PAYOUT_FIELD: Record<View, keyof PayoutStats> = {
  due: 'due', failed: 'failed', held: 'held', releasing: 'releasing', released: 'released', all: 'total',
}

export const Route = createFileRoute('/_app/money/payouts')({
  validateSearch: (s: Record<string, unknown>): { tab?: View; state?: string; view?: string } => ({
    tab: (typeof s.tab === 'string' && s.tab in VIEWS ? s.tab : s.state === 'FAILED' ? 'failed' : s.view === 'held' ? 'held' : undefined) as View | undefined,
  }),
  component: Payouts,
})

function Payouts() {
  const { tab = 'due' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = usePayouts(VIEWS[tab].f)
  const act = usePayoutAction()
  const { can } = useCan()
  const [target, setTarget] = useState<{ row: PayoutRow; action: 'hold' | 'release' | 'retry' } | null>(null)
  const { rows: rows, pager: qPager } = usePager(q)
  const stats = usePayoutStats()

  return (
    <>
      <PageHeader eyebrow="Money" title="Payouts" description="Vendor payouts by state. Held payouts are skipped by the scheduler. Failed ones show Paystack's reason." />
      <StatCards
        loading={stats.isLoading}
        items={(Object.keys(VIEWS) as View[]).map((k) => ({
          key: k,
          label: VIEWS[k].label,
          value: stats.data?.[PAYOUT_FIELD[k]],
          tone: k === 'failed' ? ('danger' as const) : k === 'held' || k === 'due' ? ('warning' as const) : undefined,
          active: tab === k,
          onClick: () => navigate({ search: { tab: k } }),
        }))}
      />
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as View } })} className="mb-4">
        <TabsList>{(Object.keys(VIEWS) as View[]).map((k) => <TabsTrigger key={k} value={k}>{VIEWS[k].label}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Panel flush>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No payouts here" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Vendor</TableHead><TableHead>State</TableHead><TableHead>Due</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Link to="/bookings/$id" params={{ id: r.id }} className="hover:underline"><Mono>{shortId(r.id)}</Mono></Link></TableCell>
                  <TableCell><Link to="/people/vendors/$id" params={{ id: r.tenantId }} className="hover:underline">{r.vendorName}</Link></TableCell>
                  <TableCell><StatusPill value={r.fundState} />{r.payoutHeldAt && <p className="mt-1 text-[11px] font-semibold text-warning">Held</p>}</TableCell>
                  <TableCell className="text-xs">{dateTime(r.payoutReleasedAt ?? r.payoutEligibleAt)}</TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">{r.fundState === 'FAILED' ? <span className="text-danger">{r.lastFailure || 'Transfer failed'}</span> : r.payoutHoldReason ?? (r.disputeStatus ? 'Disputed' : '-')}</TableCell>
                  <TableCell className="text-right font-medium tabular">{naira(r.vendorPayoutKobo)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.fundState === 'FAILED' && can('payouts.retry') && <Button size="sm" variant="outline" onClick={() => setTarget({ row: r, action: 'retry' })}><RotateCw /> Retry</Button>}
                      {r.payoutHeldAt && can('payouts.release') && <Button size="sm" variant="outline" onClick={() => setTarget({ row: r, action: 'release' })}><PlayCircle /> Release</Button>}
                      {!r.payoutHeldAt && ['HELD', 'HELD_DISPUTED', 'FAILED'].includes(r.fundState) && can('payouts.hold') && <Button size="sm" variant="ghost" onClick={() => setTarget({ row: r, action: 'hold' })}><Hand /> Hold</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
      <ReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.action === 'retry' ? 'Retry the payout' : target?.action === 'release' ? 'Release the hold' : 'Hold the payout'}
        confirmLabel={target?.action === 'retry' ? 'Retry transfer' : target?.action === 'release' ? 'Release' : 'Hold'}
        pending={act.isPending}
        consequence={target && (target.action === 'retry'
          ? `Sends ${naira(target.row.vendorPayoutKobo)} to ${target.row.vendorName} again. If the bank account changed, check it matches their verified name first.`
          : target.action === 'release' ? 'If due, the payout is sent now. You cannot release a hold you placed.' : 'The scheduler will skip this payout until it is released.')}
        onConfirm={(reason) => act.mutateAsync({ id: target!.row.id, action: target!.action, reason }).then(() => setTarget(null))}
      />
    </>
  )
}
