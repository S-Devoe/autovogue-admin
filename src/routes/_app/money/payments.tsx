import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Empty, Filters, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePayments, useWebhooks, type PaymentEvent } from '@/services/money/money.api'
import { dateTime, naira, shortId, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/money/payments')({ component: Payments })

export function EventsTable({ rows }: { rows: PaymentEvent[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>When (WAT)</TableHead><TableHead>Event</TableHead><TableHead>Booking</TableHead><TableHead>Reference</TableHead><TableHead>By</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="text-xs">{dateTime(e.createdAt)}</TableCell>
            <TableCell>
              <Pill tone={/fail|reversed/.test(e.eventType) ? 'danger' : /refund/.test(e.eventType) ? 'warning' : /success|released|charge/.test(e.eventType) ? 'success' : 'neutral'}>{e.eventType}</Pill>
              {e.reasonCode && <p className="mt-1 max-w-64 truncate text-[11px] text-muted-foreground">{e.reasonCode}</p>}
            </TableCell>
            <TableCell><Link to="/bookings/$id" params={{ id: e.bookingId }} className="hover:underline"><Mono>{shortId(e.bookingId)}</Mono></Link></TableCell>
            <TableCell><Mono className="text-muted-foreground">{e.gatewayEventRef ?? e.disbursementRef ?? e.gatewayReference ?? '-'}</Mono></TableCell>
            <TableCell className="text-xs text-muted-foreground">{titleCase(e.actorType ?? 'system')}</TableCell>
            <TableCell className="text-right font-medium tabular">{naira(e.amountKobo)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Payments() {
  const [type, setType] = useState('')
  const [ref, setRef] = useState('')
  const [applied, setApplied] = useState('')
  const q = usePayments({ type: type || undefined, reference: applied || undefined })
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="Money" title="Payments" description="Every Paystack charge, refund, payout and transfer event, as recorded from webhooks and staff actions." />
      <Panel flush>
        <Filters>
          <NativeSelect aria-label="Filter by event type" value={type} onChange={(e) => setType(e.target.value)} className="w-48">
            <NativeSelectOption value="">All events</NativeSelectOption>
            <NativeSelectOption value="charge">Charges</NativeSelectOption>
            <NativeSelectOption value="refund">Refunds</NativeSelectOption>
            <NativeSelectOption value="payout">Payouts</NativeSelectOption>
            <NativeSelectOption value="disbursement">Disbursements</NativeSelectOption>
            <NativeSelectOption value="transfer">Transfers</NativeSelectOption>
          </NativeSelect>
          <form className="relative w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); setApplied(ref.trim()) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Paystack or transfer reference" className="pl-8" />
          </form>
        </Filters>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No payment events" /> : <EventsTable rows={rows} />}
        {qPager}
      </Panel>
      <WebhookLog reference={applied || undefined} />
    </>
  )
}

/** Every Paystack webhook as received, with its signature check (FIN-1). */
function WebhookLog({ reference }: { reference?: string }) {
  const q = useWebhooks(reference)
  const { rows: qRows, pager: qPager } = usePager(q)
  const bad = qRows.filter((w) => !w.signatureOk).length ?? 0
  return (
    <Panel title="Webhook log" className="mt-5" flush
      description="What Paystack sent us, newest first. A failed signature means the call didn't come from Paystack and was refused."
      actions={bad > 0 && <Pill tone="danger">{bad} bad signature{bad === 1 ? '' : 's'}</Pill>}>
      {q.isLoading ? <Rows /> : !qRows.length ? <Empty title="No webhooks received yet" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Received</TableHead><TableHead>Event</TableHead><TableHead>Reference</TableHead><TableHead>Signature</TableHead><TableHead className="text-right">Our answer</TableHead></TableRow></TableHeader>
          <TableBody>
            {qRows.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="text-xs">{dateTime(w.receivedAt)}</TableCell>
                <TableCell className="font-mono text-xs">{w.event || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{w.reference ?? '-'}</TableCell>
                <TableCell>{w.signatureOk ? <Pill tone="success">Valid</Pill> : <Pill tone="danger">Failed</Pill>}</TableCell>
                <TableCell className="text-right tabular text-xs">{w.statusCode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {qPager}
    </Panel>
  )
}
