import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageHeader, Panel, Rows } from '@/components/common/page'
import { naira } from '@/lib/format'
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
        </Panel>

        <div className="grid gap-5">
          <Panel title="AutoVogue earnings">
            <div className="divide-y">
              <Line label="Commission earned" hint="Customer service fee and vendor commission, VAT excluded" value={b.commissionEarned} />
              <Line label="Refund fees kept" hint="Paystack fee kept on card refunds" value={b.refundFeesKept} />
              <Line label="Already moved to AutoVogue's bank" value={b.inAutovogueBank} />
            </div>
          </Panel>
          <Panel title="Open checkouts">
            <Line label="Invoiced, not paid yet" hint="Customers who opened checkout and haven't paid. Cleared automatically if the booking ends unpaid." value={b.invoicedNotPaid} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
