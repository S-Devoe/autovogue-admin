import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Ban, Banknote, CircleDollarSign, Hand, KeyRound, PlayCircle, RefreshCw, Undo2 } from 'lucide-react'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { FileViewerButton } from '@/components/common/file-viewer'
import { AuditTrail, NotesPanel } from '@/components/common/record-panel'
import { MoneyInput } from '@/components/money/money-input'
import { RefundQuoteLine } from '@/components/money/refund-quote'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAddNote, useBooking, useCancelBooking, useCancellationQuote, useConfirmPickup, useRecheckPayment, type BookingDetail as BookingDetailData, type BookingExtension, type TimelineItem } from '@/services/bookings/bookings.api'
import { useCreateRefund, useDisburse, usePayoutAction } from '@/services/money/money.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { QUERY_KEYS } from '@/services/query.keys'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/bookings/$id')({ component: BookingDetail })

type Dialogs = 'cancel' | 'refund' | 'hold' | 'release' | 'disburse' | 'pickup' | null

const CONFIRMED_BY: Record<NonNullable<BookingDetailData['booking']['pickupConfirmedBy']>, string> = {
  user: 'The user, in the app',
  auto: 'Automatically, 12 hours after pickup',
  admin: 'AutoVogue staff',
  return: 'The user, when reporting the return',
}

function BookingDetail() {
  const { id } = Route.useParams()
  const { can } = useCan()
  const q = useBooking(id)
  const recheck = useRecheckPayment()
  const cancel = useCancelBooking()
  const refund = useCreateRefund()
  const payout = usePayoutAction()
  const disburse = useDisburse()
  const confirmPickup = useConfirmPickup()
  const note = useAddNote(API_ENDPOINTS.bookingNotes, [QUERY_KEYS.BOOKING])
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [refundMode, setRefundMode] = useState<'policy' | 'none' | 'full' | 'partial'>('policy')
  const [amount, setAmount] = useState(0)
  const [cancelledFor, setCancelledFor] = useState('platform')
  const policyQuote = useCancellationQuote(id, dialog === 'cancel')

  if (q.isLoading) return <Rows n={10} />
  if (!q.data) return null
  const { booking: b, timeline, refundableKobo, refundedKobo } = q.data
  const paid = b.fundState === 'HELD' || b.fundState === 'HELD_DISPUTED'
  const unpaid = b.status === 'PENDING_PAYMENT' || b.status === 'PAYMENT_FAILED'
  const close = () => setDialog(null)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Bookings', to: '/bookings' }]}
        title={<span className="flex flex-wrap items-center gap-3">{b.vehicleName} <StatusPill value={b.status} /> <StatusPill value={b.fundState} /></span>}
        description={<>Booking <Mono>{b.id}</Mono> · {titleCase(b.serviceType)} · {dateTime(b.startTime)} to {dateTime(b.endTime)} WAT</>}
        actions={
          <>
            {can('bookings.recheck_payment') && (unpaid || b.fundState === 'PENDING') && (
              <Button variant="outline" onClick={() => recheck.mutate(id)} disabled={recheck.isPending}><RefreshCw className={cn(recheck.isPending && 'animate-spin')} /> Re-check payment</Button>
            )}
            {can('bookings.confirm_pickup') && b.status === 'ACTIVE' && !b.pickupConfirmedAt && (
              <Button variant="outline" onClick={() => setDialog('pickup')}><KeyRound /> Confirm receipt for user</Button>
            )}
            {can('refunds.create') && paid && refundableKobo > 0 && <Button variant="outline" onClick={() => { setAmount(refundableKobo); setDialog('refund') }}><Undo2 /> Refund</Button>}
            {can('payouts.hold') && paid && !b.payoutHeldAt && <Button variant="outline" onClick={() => setDialog('hold')}><Hand /> Hold payout</Button>}
            {can('payouts.release') && b.payoutHeldAt && <Button variant="outline" onClick={() => setDialog('release')}><PlayCircle /> Release hold</Button>}
            {can('disbursements.create') && b.fundState === 'HELD' && !b.payoutHeldAt && !b.disputeStatus && <Button variant="outline" onClick={() => setDialog('disburse')}><Banknote /> Pay vendor now</Button>}
            {(can('bookings.cancel_unpaid') && !paid) || (can('bookings.cancel_paid') && paid)
              ? !['COMPLETED', 'CANCELLED'].includes(b.status) && <Button variant="outline" className="text-danger" onClick={() => { setRefundMode(paid ? 'policy' : 'none'); setDialog('cancel') }}><Ban /> Cancel booking</Button>
              : null}
          </>
        }
      />

      {b.payoutHeldAt && (
        <div className="rise mb-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <b>Payout on hold</b> since {dateTime(b.payoutHeldAt)}{b.payoutHoldReason && `: ${b.payoutHoldReason}`}. The scheduler won't pay this vendor until it is released.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel title="People and car">
            <KV cols={3} items={[
              ['User', <Link to="/people/users/$id" params={{ id: b.customerId }} className="font-medium hover:underline">{b.customerName}</Link>],
              ['User email', b.customerEmail],
              ['User phone', b.customerPhone],
              ['Vendor', <Link to="/people/vendors/$id" params={{ id: b.tenantId }} className="font-medium hover:underline">{b.vendorName}</Link>],
              ['Vendor type', titleCase(b.tenantType)],
              ['Vehicle', <Link to="/listings/$id" params={{ id: b.vehicleId }} className="hover:underline">{b.vehicleName} ({b.vehicleYear}) · <span className="font-mono">{b.licensePlate}</span></Link>],
              ['Pickup odometer', b.pickupOdometerKm != null ? `${b.pickupOdometerKm} km` : '-'],
              ['Return odometer', b.returnOdometerKm != null ? `${b.returnOdometerKm} km` : '-'],
              ['Payment via', titleCase(b.paymentGateway)],
            ]} />
            {can('files.view_trip') && (b.startFuelPhotoUrl || b.endFuelPhotoUrl) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <FileViewerButton fileRef={b.startFuelPhotoUrl} label="Pickup fuel photo" target={{ type: 'booking', id }} />
                <FileViewerButton fileRef={b.endFuelPhotoUrl} label="Return fuel photo" target={{ type: 'booking', id }} />
              </div>
            )}
          </Panel>

          <Panel title="Handover" description="Vendors can't complete the trip until the user has received the car and either reported it returned or the end time has passed.">
            <KV cols={2} items={[
              ['Received the car', b.pickupConfirmedAt ? dateTime(b.pickupConfirmedAt) : 'Not confirmed yet'],
              ['Confirmed by', b.pickupConfirmedBy ? CONFIRMED_BY[b.pickupConfirmedBy] : '-'],
              ['User reported the car returned', b.returnReportedAt ? dateTime(b.returnReportedAt) : 'Not yet'],
            ]} />
          </Panel>

          <ExtensionsPanel extensions={q.data.extensions ?? []} />

          <Panel title="Timeline" description="Booking events, payments and each Paystack re-check, oldest first." flush>
            <ol className="relative px-5 py-4">
              {timeline.map((t, i) => <TimelineRow key={i} t={t} last={i === timeline.length - 1} />)}
              {timeline.length === 0 && <p className="text-sm text-muted-foreground">No events recorded yet.</p>}
            </ol>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel title="Money" description="Kobo is stored; naira shown.">
            <dl className="grid gap-2 text-sm tabular">
              <Line k="Base price" v={naira(b.baseAmountKobo)} />
              <Line k="Fuel" v={naira(b.fuelAmountKobo)} />
              <Line k="Caution fee" v={naira(b.cautionFeeKobo)} />
              <Line k="Commission (all)" v={naira(b.totalCommissionKobo)} />
              <Line k="User paid" v={naira(b.totalInvoiceKobo)} strong />
              <Line k="Vendor payout" v={naira(b.vendorPayoutKobo)} />
              <Line k="AutoVogue net" v={naira(b.autovogueNetKobo)} />
              <Line k="Refunded so far" v={naira(refundedKobo)} />
              <Line k="Payout due" v={dateTime(b.payoutEligibleAt)} />
              <Line k="Payout released" v={dateTime(b.payoutReleasedAt)} />
              <Line k="Paystack reference" v={<Mono>{b.gatewayReference ?? '-'}</Mono>} />
            </dl>
          </Panel>
          <NotesPanel notes={q.data.notes} canAdd={can('bookings.notes')} pending={note.isPending} onAdd={(body) => note.mutateAsync({ id, body })} />
          <AuditTrail targetType="booking" targetId={id} />
        </div>
      </div>

      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && close()}
        title="Cancel this booking"
        destructive
        confirmLabel="Cancel booking"
        pending={cancel.isPending}
        canConfirm={refundMode !== 'partial' || (amount > 0 && amount <= refundableKobo)}
        consequence={paid ? "The booking is paid. Choose what the user gets back; it goes to their AutoVogue wallet, less the Paystack fee. Both sides are notified." : 'The booking is not paid, so nothing is refunded. Both sides are notified.'}
        onConfirm={(reason) => cancel.mutateAsync({ id, reason, refund: paid ? refundMode : 'none', refundKobo: refundMode === 'partial' ? amount : undefined, cancelledFor }).then(close)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Cancelled for</FieldLabel>
            <NativeSelect aria-label="Cancelled on behalf of" value={cancelledFor} onChange={(e) => setCancelledFor(e.target.value)} className="w-full">
              <NativeSelectOption value="renter">The user</NativeSelectOption>
              <NativeSelectOption value="vendor">The vendor</NativeSelectOption>
              <NativeSelectOption value="platform">AutoVogue</NativeSelectOption>
            </NativeSelect>
          </Field>
          {paid && (
            <Field>
              <FieldLabel>Refund</FieldLabel>
              <NativeSelect aria-label="Refund" value={refundMode} onChange={(e) => setRefundMode(e.target.value as typeof refundMode)} className="w-full">
                <NativeSelectOption value="policy">Follow the cancellation policy</NativeSelectOption>
                <NativeSelectOption value="full">Full ({naira(refundableKobo)})</NativeSelectOption>
                <NativeSelectOption value="partial">Partial</NativeSelectOption>
                <NativeSelectOption value="none">No refund</NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
        </div>
        {paid && refundMode === 'partial' && <MoneyInput kobo={amount} onChange={setAmount} max={refundableKobo} />}
        {paid && refundMode === 'policy' && policyQuote.data && (
          <p className="text-xs text-muted-foreground">
            {policyQuote.data.hoursBeforePickup} hours before pickup: the {policyQuote.data.tier} tier refunds {policyQuote.data.pct}% of the rental plus the caution fee. Any other choice is an override; say why in the reason.
          </p>
        )}
        {paid && refundMode !== 'none' && (
          <RefundQuoteLine bookingId={id} amountKobo={refundMode === 'full' ? refundableKobo : refundMode === 'policy' ? policyQuote.data?.amountKobo ?? 0 : amount} toWallet />
        )}
      </ReasonDialog>

      <ReasonDialog
        open={dialog === 'refund'}
        onOpenChange={(o) => !o && close()}
        title="Refund the user"
        confirmLabel={`Refund ${naira(amount)}`}
        pending={refund.isPending}
        canConfirm={amount > 0 && amount <= refundableKobo}
        consequence="Money goes back to where the user paid from (card/bank via Paystack, or their wallet), less the Paystack fee. A partial refund also holds the vendor payout for review. Large refunds wait for a second approver."
        onConfirm={(reason) => refund.mutateAsync({ bookingId: id, amountKobo: amount, reason }).then(close)}
      >
        <MoneyInput kobo={amount} onChange={setAmount} max={refundableKobo} />
        <RefundQuoteLine bookingId={id} amountKobo={amount} toWallet={b.paymentGateway === 'wallet'} />
      </ReasonDialog>

      <ReasonDialog open={dialog === 'hold'} onOpenChange={(o) => !o && close()} title="Hold the vendor payout" confirmLabel="Hold payout" pending={payout.isPending}
        consequence="The payout scheduler will skip this booking until someone else releases the hold."
        onConfirm={(reason) => payout.mutateAsync({ id, action: 'hold', reason }).then(close)} />
      <ReasonDialog open={dialog === 'release'} onOpenChange={(o) => !o && close()} title="Release the hold" confirmLabel="Release" pending={payout.isPending}
        consequence="If the payout is already due it is sent now. You can't release a hold you placed yourself."
        onConfirm={(reason) => payout.mutateAsync({ id, action: 'release', reason }).then(close)} />
      <ReasonDialog open={dialog === 'disburse'} onOpenChange={(o) => !o && close()} title="Pay the vendor now" confirmLabel={`Pay ${naira(b.vendorPayoutKobo)}`} pending={disburse.isPending}
        consequence={<>Sends {naira(b.vendorPayoutKobo)} to the vendor's verified settlement account through Paystack. Above the approval threshold it waits for a second approver.</>}
        onConfirm={(reason) => disburse.mutateAsync({ id, reason }).then(close)} />
      <ReasonDialog open={dialog === 'pickup'} onOpenChange={(o) => !o && close()} title="Confirm receipt for the user" confirmLabel="Confirm receipt" pending={confirmPickup.isPending}
        consequence="Use this when the user has the car but forgot to confirm in the app. The vendor's share is released."
        onConfirm={(reason) => confirmPickup.mutateAsync({ id, reason }).then(close)} />
    </>
  )
}

function Line({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', strong && 'border-y py-2 font-semibold')}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )
}

const ICON: Record<TimelineItem['source'], React.ReactNode> = {
  event: <CircleDollarSign className="size-3.5" />,
  payment: <Banknote className="size-3.5" />,
  payment_check: <RefreshCw className="size-3.5" />,
}

function TimelineRow({ t, last }: { t: TimelineItem; last: boolean }) {
  const bad = /fail|reversed|expired/i.test(t.type + (t.detail ?? ''))
  return (
    <li className="relative flex gap-3 pb-5">
      {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-border" />}
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground', bad && 'border-danger/40 bg-danger-soft text-danger', t.source === 'payment' && !bad && 'border-success/30 bg-success-soft text-success')}>
        {ICON[t.source]}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {titleCase(t.type.replace(/\./g, ' '))}
          {t.amountKobo != null && <span className="font-semibold tabular">{naira(t.amountKobo)}</span>}
          {t.fundState && <Pill tone="neutral" dot={false}>{titleCase(t.fundState)}</Pill>}
        </p>
        {t.detail && <p className="text-xs text-muted-foreground">{t.detail}</p>}
        <p className="text-[11px] text-muted-foreground">{dateTime(t.at)}{t.actorType && ` · by ${t.actorType}`}</p>
      </div>
    </li>
  )
}

const EXT_STATUS: Record<BookingExtension['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  PAID: { label: 'Paid', tone: 'success' },
  PENDING_PAYMENT: { label: 'Waiting for payment', tone: 'warning' },
  CANCELLED: { label: 'Not paid (replaced or expired)', tone: 'neutral' },
  REFUNDED: { label: 'Refunded to wallet', tone: 'danger' },
}

/** Extension amounts come in naira (the rest of this page uses kobo). */
const ngnN = (n?: number) => naira(n == null ? null : Math.round(n * 100))

function ExtensionsPanel({ extensions }: { extensions: BookingExtension[] }) {
  if (extensions.length === 0) return null
  const paid = extensions.filter((e) => e.status === 'PAID')
  return (
    <Panel
      title="Trip extensions"
      description="Extra time the user bought during the trip. Charged with the service charge and VAT, never a caution fee. The vendor's share goes to their wallet once paid."
    >
      <ol className="grid gap-4">
        {extensions.map((e) => (
          <li key={e.id} className="grid gap-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                +{e.units} {e.unit}
                {e.units === 1 ? '' : 's'}
              </span>
              <Pill tone={EXT_STATUS[e.status].tone}>{EXT_STATUS[e.status].label}</Pill>
            </div>
            <KV cols={2} items={[
              ['Was due back', dateTime(e.oldEndTime)],
              ['New return time', dateTime(e.newEndTime)],
              ['Rental', ngnN(e.rental)],
              ['User service charge + VAT', ngnN(e.serviceFee + e.vat)],
              [e.status === 'PAID' || e.status === 'REFUNDED' ? 'User paid' : 'Price (not paid)', ngnN(e.total)],
              ['Paid with', e.paidWith === 'wallet' ? 'Wallet' : e.paidWith === 'paystack' ? 'Paystack' : '-'],
              ['Vendor commission + VAT', ngnN(e.vendorCommission + e.vendorVat)],
              [e.status === 'PAID' ? 'Vendor share' : 'Vendor share (if paid)', ngnN(e.vendorShare)],
              ['Started', dateTime(e.createdAt)],
              ['Paid', e.paidAt ? dateTime(e.paidAt) : '-'],
              ['In vendor wallet', e.releasedAt ? dateTime(e.releasedAt) : e.status === 'PAID' ? 'Pending' : '-'],
            ]} />
          </li>
        ))}
      </ol>
      {paid.length > 1 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {paid.length} paid extensions: user paid {ngnN(paid.reduce((s, e) => s + e.total, 0))}, vendor share {ngnN(paid.reduce((s, e) => s + e.vendorShare, 0))}.
        </p>
      )}
    </Panel>
  )
}
