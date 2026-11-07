import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { FileText, MessageSquareLock, PauseCircle, PlayCircle, Scale, UserCheck } from 'lucide-react'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { ChatThread } from '@/components/common/chat-thread'
import { FileViewerButton } from '@/components/common/file-viewer'
import { AuditTrail } from '@/components/common/record-panel'
import { MoneyInput } from '@/components/money/money-input'
import { RefundQuoteLine } from '@/components/money/refund-quote'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { openDisputeChat, useAssignDispute, useDispute, useRequestInfo, useResolveDispute, useResumeDispute, type ChatMessage, type Outcome } from '@/services/disputes/disputes.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SlaClock } from './index'

export const Route = createFileRoute('/_app/disputes/$id')({ component: Workspace })

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: 'renter', label: 'For the user', hint: 'Refund the user (full by default).' },
  { value: 'vendor', label: 'For the vendor', hint: 'Release the full vendor payout.' },
  { value: 'split', label: 'Split', hint: 'Refund part, pay the vendor part.' },
  { value: 'no_money', label: 'No money moves', hint: 'Close it; the money stays where it is.' },
]

function Workspace() {
  const { id } = Route.useParams()
  const { can, me } = useCan()
  const q = useDispute(id)
  const assign = useAssignDispute()
  const info = useRequestInfo()
  const resume = useResumeDispute()
  const resolve = useResolveDispute()
  const [chat, setChat] = useState<ChatMessage[] | null>(null)
  const [askChat, setAskChat] = useState(false)
  const [askInfo, setAskInfo] = useState(false)
  const [infoFrom, setInfoFrom] = useState<'customer' | 'tenant'>('customer')
  const [infoMsg, setInfoMsg] = useState('')
  const [resolving, setResolving] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>('renter')
  const [refund, setRefund] = useState(0)
  const [release, setRelease] = useState(0)
  const [penalty, setPenalty] = useState(0)

  if (q.isLoading || !q.data) return <Rows n={10} />
  const { dispute: d, evidence, booking: bd, resolution, hasChat, slaSecondsLeft } = q.data
  const b = bd.booking
  const open = d.status === 'open' || d.status === 'under_review'
  const moneyOk = can('disputes.resolve_money')
  const valid =
    outcome === 'no_money' || (outcome === 'vendor' && penalty < (b.vendorPayoutKobo ?? 0)) ||
    (outcome === 'renter' && refund > 0 && refund <= bd.refundableKobo) ||
    (outcome === 'split' && refund > 0 && release > 0 && release <= (b.vendorPayoutKobo ?? 0) && refund + release <= bd.refundableKobo)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Disputes', to: '/disputes' }]}
        title={<span className="flex flex-wrap items-center gap-3">{titleCase(d.category)} dispute <StatusPill value={d.status} /></span>}
        description={<>Raised by the {d.raisedBy === 'customer' ? 'user' : 'vendor'} {dateTime(d.createdAt)} · booking <Link to="/bookings/$id" params={{ id: d.bookingId }} className="underline"><Mono>{d.bookingId}</Mono></Link></>}
        actions={open && (
          <>
            {!d.assigneeId || d.assigneeId !== me?.id ? (
              can('disputes.assign') && <Button variant="outline" onClick={() => assign.mutate({ id })}><UserCheck /> Assign to me</Button>
            ) : null}
            {can('disputes.resolve') && (d.pausedAt
              ? <Button variant="outline" onClick={() => resume.mutate(id)}><PlayCircle /> Reply received, resume</Button>
              : <Button variant="outline" onClick={() => setAskInfo(true)}><PauseCircle /> Request info</Button>)}
            {can('disputes.resolve') && <Button onClick={() => { setOutcome(moneyOk ? 'renter' : 'no_money'); setRefund(bd.refundableKobo); setRelease(0); setResolving(true) }}><Scale /> Resolve</Button>}
          </>
        )}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Tile label="72-hour target" value={open ? <SlaClock due={d.slaDueAt} paused={d.pausedAt} /> : 'Closed'} sub={open && !d.pausedAt ? `${Math.round(slaSecondsLeft / 3600)}h` : undefined} />
        <Tile label="Assignee" value={d.assigneeName ?? <span className="text-warning">Unassigned</span>} />
        <Tile label="User paid" value={naira(b.totalInvoiceKobo)} sub={`${naira(bd.refundableKobo)} still refundable`} />
        <Tile label="Funds" value={<StatusPill value={b.fundState} />} sub={`Vendor payout ${naira(b.vendorPayoutKobo)}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel title="Statement">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.description}</p>
            {d.pausedAt && <p className="mt-3 rounded-md bg-info-soft px-3 py-2 text-xs text-info">Waiting for the {d.infoRequestedFrom === 'tenant' ? 'vendor' : 'user'} to reply (since {dateTime(d.pausedAt)}). The clock is paused.</p>}
            {resolution && (
              <div className="mt-4 rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
                <p className="font-semibold text-success">Resolved: {OUTCOMES.find((o) => o.value === resolution.outcome)?.label}</p>
                <p className="text-xs">Refund {naira(resolution.refundKobo)} · release {naira(resolution.releaseKobo)} · {dateTime(resolution.createdAt)}</p>
                <p className="mt-1 text-xs">{resolution.note}</p>
              </div>
            )}
          </Panel>
          <Panel title="Evidence" description={d.evidenceShared ? 'Shared with both sides.' : 'Only the uploader and staff can see it.'}>
            {evidence.length === 0 ? <p className="text-sm text-muted-foreground">No files uploaded.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {evidence.map((ref, i) => (
                  <li key={ref} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /> File {i + 1}</span>
                    {can('files.view_evidence') ? <FileViewerButton fileRef={ref} target={{ type: 'dispute', id }} /> : <span className="text-xs text-muted-foreground">No access</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Booking chat" description="Read only. Opening it is logged with your reason." actions={hasChat && can('disputes.view_chat') && !chat && <Button size="sm" variant="outline" onClick={() => setAskChat(true)}><MessageSquareLock /> Open chat</Button>}>
            {!hasChat ? <p className="text-sm text-muted-foreground">The user and vendor haven't chatted on this booking.</p> : !chat ? <p className="text-sm text-muted-foreground">Hidden until opened.</p> : <ChatThread messages={chat} />}
          </Panel>
        </div>
        <div className="grid content-start gap-5">
          <Panel title="Booking">
            <KV cols={1} items={[
              ['User', <Link to="/people/users/$id" params={{ id: b.customerId }} className="hover:underline">{b.customerName}</Link>],
              ['Vendor', <Link to="/people/vendors/$id" params={{ id: b.tenantId }} className="hover:underline">{b.vendorName}</Link>],
              ['Vehicle', `${b.vehicleName} · ${b.licensePlate}`],
              ['Trip', `${dateTime(b.startTime)} to ${dateTime(b.endTime)}`],
              ['Caution fee', naira(b.cautionFeeKobo)],
            ]} />
            <ol className="mt-4 grid gap-1.5 border-t pt-3 text-xs">
              {bd.timeline.slice(-8).map((t, i) => (
                <li key={i} className="flex justify-between gap-2"><span>{titleCase(t.type.replace(/\./g, ' '))}{t.amountKobo != null && ` ${naira(t.amountKobo)}`}</span><span className="text-muted-foreground">{dateTime(t.at)}</span></li>
              ))}
            </ol>
          </Panel>
          <AuditTrail targetType="dispute" targetId={id} />
        </div>
      </div>

      <ReasonDialog open={askChat} onOpenChange={setAskChat} title="Open the booking chat" confirmLabel="Open chat"
        consequence="Private messages between the user and vendor. Your name, the time and this reason are logged."
        onConfirm={async (reason) => { setChat(await openDisputeChat(id, reason)); setAskChat(false) }} />

      <Dialog open={askInfo} onOpenChange={setAskInfo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Request more information</DialogTitle>
            <DialogDescription>The person is notified in their app. The 72-hour clock pauses until you resume it.</DialogDescription>
          </DialogHeader>
          <Field><FieldLabel>Ask</FieldLabel>
            <NativeSelect aria-label="Ask whom" value={infoFrom} onChange={(e) => setInfoFrom(e.target.value as typeof infoFrom)} className="w-full">
              <NativeSelectOption value="customer">The user</NativeSelectOption>
              <NativeSelectOption value="tenant">The vendor</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field><FieldLabel>What do you need?</FieldLabel><Textarea value={infoMsg} onChange={(e) => setInfoMsg(e.target.value)} rows={3} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskInfo(false)}>Cancel</Button>
            <Button disabled={infoMsg.trim().length < 5 || info.isPending} onClick={() => info.mutateAsync({ id, from: infoFrom, message: infoMsg.trim() }).then(() => { setAskInfo(false); setInfoMsg('') })}>Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={resolving}
        onOpenChange={setResolving}
        title="Resolve the dispute"
        reasonLabel="Decision note (both sides are notified; saved in the audit log)"
        confirmLabel={outcome === 'no_money' ? 'Close dispute' : 'Resolve and move money'}
        pending={resolve.isPending}
        canConfirm={valid}
        consequence="One action records the decision, moves the money and notifies both sides. It can't be repeated. Above the approval threshold it waits for someone with money approval."
        onConfirm={(note) => resolve.mutateAsync({ id, outcome, refundKobo: outcome === 'vendor' || outcome === 'no_money' ? 0 : refund, releaseKobo: outcome === 'split' ? release : 0, penaltyKobo: outcome === 'vendor' ? penalty : 0, note }).then(() => setResolving(false))}
      >
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.filter((o) => moneyOk || o.value === 'no_money').map((o) => (
            <button key={o.value} onClick={() => setOutcome(o.value)} className={cn('rounded-lg border p-3 text-left transition hover:border-ring/40', outcome === o.value && 'border-primary bg-secondary')}>
              <p className="text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
            </button>
          ))}
        </div>
        {(outcome === 'renter' || outcome === 'split') && <Field><FieldLabel>Refund to user</FieldLabel><MoneyInput kobo={refund} onChange={setRefund} max={bd.refundableKobo} /></Field>}
        {(outcome === 'renter' || outcome === 'split') && refund > 0 && <RefundQuoteLine bookingId={b.id} amountKobo={refund} />}
        {outcome === 'split' && <Field><FieldLabel>Pay to vendor</FieldLabel><MoneyInput kobo={release} onChange={setRelease} max={b.vendorPayoutKobo ?? 0} /></Field>}
        {outcome === 'vendor' && (
          <>
            <p className="rounded-md bg-muted px-3 py-2 text-sm">Releases {naira((b.vendorPayoutKobo ?? 0) - penalty)} to the vendor{penalty === 0 && ' and returns the caution fee as normal'}.</p>
            <Field><FieldLabel>Penalty for the vendor (optional)</FieldLabel><MoneyInput kobo={penalty} onChange={setPenalty} max={(b.vendorPayoutKobo ?? 0) - 1} /></Field>
          </>
        )}
        {outcome === 'split' && refund + release > 0 && <p className="text-xs text-muted-foreground">Total moved {naira(refund + release)} of {naira(bd.refundableKobo)}. Fund state ends <Pill tone="success">Partially released</Pill></p>}
      </ReasonDialog>
    </>
  )
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rise rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-sm font-semibold">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
