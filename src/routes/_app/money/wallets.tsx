import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Lock, Search, Unlock } from 'lucide-react'
import { Empty, KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet, useWalletFreeze } from '@/services/money/money.api'
import { useUsers } from '@/services/people/people.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/money/wallets')({
  validateSearch: (s: Record<string, unknown>): { user?: string } => ({ user: typeof s.user === 'string' ? s.user : undefined }),
  component: Wallets,
})

function Wallets() {
  const { user } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')
  const users = useUsers({ q: q || undefined })
  const found = users.data?.pages.flatMap((p) => p.items).slice(0, 8) ?? []
  return (
    <>
      <PageHeader eyebrow="Money" title="Wallets" description="User wallets: balance, transactions and withdrawals. Freeze a wallet during a fraud check." />
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Find a user" flush>
          <form className="relative p-3" onSubmit={(e) => { e.preventDefault(); setQ(term.trim()) }}>
            <Search className="pointer-events-none absolute left-5.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, email or phone" className="pl-8" />
          </form>
          <ul className="divide-y border-t">
            {q && found.map((u) => (
              <li key={u.id}>
                <button onClick={() => navigate({ search: { user: u.id } })} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted ${user === u.id ? 'bg-accent' : ''}`}>
                  <p className="font-medium">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </button>
              </li>
            ))}
            {q && !users.isLoading && found.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No users found</li>}
          </ul>
        </Panel>
        {user ? <WalletView userId={user} /> : <Panel><Empty title="Pick a user" hint="Search on the left to open their wallet." /></Panel>}
      </div>
    </>
  )
}

export function WalletView({ userId }: { userId: string }) {
  const { can } = useCan()
  const q = useWallet(userId)
  const freeze = useWalletFreeze()
  const [open, setOpen] = useState(false)
  if (q.isLoading) return <Panel><Rows /></Panel>
  if (!q.data) return <Panel><Empty title="No wallet" hint="Wallets are created after the user's KYC is verified." /></Panel>
  const { wallet: w, transactions } = q.data
  const frozen = w.status === 'frozen'
  return (
    <div className="grid content-start gap-5">
      <Panel
        title={<span className="flex items-center gap-2">Wallet <StatusPill value={frozen ? 'suspended' : 'active'} label={frozen ? 'Frozen' : 'Active'} /></span>}
        actions={can('wallets.freeze') && (
          <Button variant="outline" size="sm" className={frozen ? '' : 'text-danger'} onClick={() => setOpen(true)}>{frozen ? <><Unlock /> Unfreeze</> : <><Lock /> Freeze</>}</Button>
        )}
      >
        <p className="font-display text-3xl font-semibold tabular">{naira(w.balanceKobo)}</p>
        {frozen && <p className="mt-1 text-sm text-danger">Frozen {dateTime(w.frozenAt)}: {w.freezeReason}</p>}
        <div className="mt-4">
          <KV cols={3} items={[
            ['User', <Link to="/people/users/$id" params={{ id: userId }} className="hover:underline">Open profile</Link>],
            ['Virtual account', `${w.virtualAccountBank ?? '-'} ${w.virtualAccountNumber ?? ''}`],
            ['Account status', titleCase(w.virtualAccountStatus)],
            ['Withdraws to', w.withdrawalBank ? `${w.withdrawalBank} ${w.withdrawalAccountNumber}` : 'Not set'],
            ['Account name', w.withdrawalAccountName ?? '-'],
            ['PIN', w.pinLocked ? <Pill tone="warning">Locked</Pill> : 'OK'],
          ]} />
        </div>
      </Panel>
      <Panel title="Transactions" flush>
        {transactions.length === 0 ? <Empty title="No transactions yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{dateTime(t.createdAt)}</TableCell>
                  <TableCell>{titleCase(t.kind)}</TableCell>
                  <TableCell><StatusPill value={t.status === 'succeeded' ? 'verified' : t.status === 'failed' ? 'failed' : 'pending'} label={titleCase(t.status)} /></TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{t.description ?? t.counterpartyName ?? '-'}{t.failureReason && <span className="text-danger"> · {t.failureReason}</span>} <Mono>{t.reference.slice(-10)}</Mono></TableCell>
                  <TableCell className={`text-right font-medium tabular ${t.direction === 'credit' ? 'text-success' : ''}`}>{t.direction === 'credit' ? '+' : '-'}{naira(t.amountKobo)}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">{naira(t.balanceAfterKobo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <ReasonDialog open={open} onOpenChange={setOpen} title={frozen ? 'Unfreeze wallet' : 'Freeze wallet'} destructive={!frozen} confirmLabel={frozen ? 'Unfreeze' : 'Freeze wallet'} pending={freeze.isPending}
        consequence={frozen ? 'The user can withdraw and pay with the wallet again.' : 'The user cannot withdraw or pay with the wallet until it is unfrozen. Their balance is kept.'}
        onConfirm={(reason) => freeze.mutateAsync({ userId, freeze: !frozen, reason }).then(() => setOpen(false))} />
    </div>
  )
}
