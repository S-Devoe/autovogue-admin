import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageHeader, Panel, Rows } from '@/components/common/page'
import { dateTime, naira } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePlatformBalances, type PlatformBalances } from '@/services/money/money.api'

export const Route = createFileRoute('/_app/money/balances')({ component: Balances })

/** API amounts are naira; the formatter takes kobo. */
const n = (v: number) => naira(Math.round(v * 100))

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-4', ok ? 'border-success/30 bg-success-soft' : 'border-danger/40 bg-danger-soft')}>
      {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />}
      <div>
        <p className={cn('text-sm font-semibold', ok ? 'text-success' : 'text-danger')}>{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function Line({ label, hint, value, total, strong }: { label: string; hint?: string; value: number; total?: number; strong?: boolean }) {
  const pct = total && total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : null
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className={cn('text-sm', strong ? 'font-semibold' : 'font-medium')}>{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <p className={cn('tabular text-sm', strong ? 'font-semibold' : 'font-medium')}>{n(value)}</p>
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function Balances() {
  const q = usePlatformBalances()
  const b = q.data
  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Platform balances"
        description="Where every naira is, straight from the ledger: what sits in the Paystack balance, who it belongs to, and what is AutoVogue's. Refreshes every minute."
      />
      {q.isLoading || !b ? <Rows /> : <Content b={b} />}
    </>
  )
}

function Content({ b }: { b: PlatformBalances }) {
  const c = b.checks
  const owedOut = b.owedToVendorsEscrow + b.owedToVendorsWallets + b.owedToUsersWallets + b.cautionFeesHeld + b.vatOwed
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Check ok={c.ledgerBalanced} label={c.ledgerBalanced ? 'Ledger balanced' : 'Ledger out of balance'}
          detail={c.ledgerBalanced ? 'Every debit has a matching credit.' : `Off by ${n(c.ledgerDifference)}. Run reconciliation and investigate.`} />
        <Check ok={c.userWalletsMatch} label={c.userWalletsMatch ? 'User wallets match' : 'User wallets don’t match'}
          detail={`Wallets hold ${n(c.userWalletsTotal)}; the ledger says ${n(b.owedToUsersWallets)}.`} />
        <Check ok={c.vendorWalletsMatch} label={c.vendorWalletsMatch ? 'Vendor wallets match' : 'Vendor wallets don’t match'}
          detail={`Wallets hold ${n(c.vendorWalletsTotal)}; the ledger says ${n(b.owedToVendorsWallets)}.`} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={`Held at Paystack: ${n(b.heldAtPaystack)}`} description="Who that money belongs to.">
          <div className="divide-y">
            <Line label="Vendors: trips in escrow" hint="Paid trips not yet released to the vendor" value={b.owedToVendorsEscrow} total={b.heldAtPaystack} />
            <Line label="Vendors: wallets" hint="Released to vendors, not yet withdrawn" value={b.owedToVendorsWallets} total={b.heldAtPaystack} />
            <Line label="Users: wallets" hint="Top-ups and refunds users can spend or withdraw" value={b.owedToUsersWallets} total={b.heldAtPaystack} />
            <Line label="Caution fees held" hint="Goes back to users after their trips" value={b.cautionFeesHeld} total={b.heldAtPaystack} />
            <Line label="VAT owed to FIRS" hint="Collected on AutoVogue's fees; remit to FIRS" value={b.vatOwed} total={b.heldAtPaystack} />
            <Line label="AutoVogue's own" hint="What's left after everything owed: yours to move out" value={b.autovogueAtPaystack} total={b.heldAtPaystack} strong />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Owed to others in total: {n(owedOut)}.</p>
          <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">How this is worked out</p>
            <p className="mt-1">
              Only paid bookings count here: money that has actually reached Paystack and that we hold for someone. Unpaid checkouts are never
              included; they are shown on their own under Unpaid checkouts.
            </p>
            <p className="mt-1">AutoVogue&apos;s own is what Paystack holds minus everything above, which is the commission from paid bookings not yet moved to your bank.</p>
            {b.autovogueAtPaystack < 0 && (
              <p className="mt-1 font-medium text-danger">
                Negative means the ledger says more is owed than Paystack holds. Check Reconciliation before moving any money.
              </p>
            )}
          </div>
        </Panel>

        <div className="grid gap-5">
          <Panel title="AutoVogue earnings">
            <div className="divide-y">
              <Line label="Commission earned" hint="Customer service fee and vendor commission, VAT excluded" value={b.commissionEarned} />
              <Line label="Refund fees kept" hint="Paystack fee kept on card refunds" value={b.refundFeesKept} />
              <Line label="Already moved to AutoVogue's bank" value={b.inAutovogueBank} />
            </div>
          </Panel>
          <UnpaidCheckouts b={b} />
        </div>
      </div>
    </div>
  )
}

/**
 * Unpaid checkouts, kept apart from everything else on the page: a user
 * opened a checkout but no money has arrived, so none of it is owed to
 * anyone yet.
 */
function UnpaidCheckouts({ b }: { b: PlatformBalances }) {
  const count = b.openCheckouts ?? 0
  const list = b.largestOpenCheckouts ?? []
  return (
    <Panel title="Unpaid checkouts" description="Not money we hold. Not counted anywhere else on this page.">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Total not paid yet</p>
          <p className="text-xs text-muted-foreground">{count === 1 ? '1 checkout' : `${count} checkouts`} waiting for the user to pay</p>
        </div>
        <p className="font-display text-xl font-semibold tabular">{n(b.invoicedNotPaid)}</p>
      </div>

      {count > 0 && (
        <>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">If they pay, it becomes</p>
          <div className="mt-1 divide-y text-sm">
            <Row k="Rental for vendors (escrow)" v={n(b.openCheckoutRental ?? 0)} />
            <Row k="Caution fees (back to users after the trip)" v={n(b.openCheckoutCaution ?? 0)} />
            <Row k="AutoVogue service fee" v={n(b.openCheckoutServiceFee ?? 0)} />
            <Row k="VAT on the service fee (FIRS)" v={n(b.openCheckoutVat ?? 0)} />
          </div>

          {list.length > 0 && (
            <>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Biggest unpaid checkouts</p>
              <ul className="mt-1 divide-y text-sm">
                {list.map((c) => (
                  <li key={c.bookingId} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link to="/bookings/$id" params={{ id: c.bookingId }} className="font-medium hover:underline">
                        {c.ref}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.customer} · {c.vehicle}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.expiresAt ? `Expires ${dateTime(c.expiresAt)}` : `Started ${dateTime(c.startedAt)}`}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular">{n(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">What this means</p>
        <p className="mt-1">
          When a user opens a checkout, the price is written down straight away so the payment can be matched when it arrives. Until the user
          pays, no money has come in, so it isn&apos;t owed to the vendor, the user or FIRS, and it isn&apos;t AutoVogue&apos;s.
        </p>
        <p className="mt-1">
          If they pay, the amount moves into the lines on the left. If they don&apos;t, the checkout expires after 24 hours and is cleared from the
          books automatically. A big number here usually just means someone started an expensive booking and hasn&apos;t paid.
        </p>
        <p className="mt-1">
          Wallet top-ups a user started but didn&apos;t finish never show anywhere: a wallet only changes once Paystack confirms the payment,
          and unfinished ones are checked with Paystack and closed automatically.
        </p>
      </div>
    </Panel>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular">{v}</span>
    </div>
  )
}
