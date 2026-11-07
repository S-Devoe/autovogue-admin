import { createFileRoute, Link } from '@tanstack/react-router'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { AuditTrail, NotesPanel } from '@/components/common/record-panel'
import { AccountActions } from '@/components/people/account-actions'
import { DocsTable } from '@/components/people/docs-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUser } from '@/services/people/people.api'
import { useAddNote } from '@/services/bookings/bookings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { QUERY_KEYS } from '@/services/query.keys'
import { useCan } from '@/hooks/use-can'
import { dateOnly, dateTime, naira, shortId } from '@/lib/format'

export const Route = createFileRoute('/_app/people/users/$id')({ component: User })

function User() {
  const { id } = Route.useParams()
  const { can } = useCan()
  const q = useUser(id)
  const note = useAddNote((x) => API_ENDPOINTS.accountAction('users', x, 'notes'), [QUERY_KEYS.USER])
  if (q.isLoading || !q.data) return <Rows n={10} />
  const { user: u, wallet, documents, recentBookings, openBookings, notes, verifiedLegalName } = q.data
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Users', to: '/people/users' }]}
        title={<span className="flex flex-wrap items-center gap-3">{u.firstName} {u.lastName} {u.suspendedAt ? <Pill tone="danger">Suspended</Pill> : u.isVerified ? <Pill tone="success">Verified</Pill> : <Pill>Not verified</Pill>}</span>}
        description={<>{u.email} · joined {dateOnly(u.createdAt)} · <Mono>{u.id}</Mono></>}
        actions={<AccountActions kind="users" id={id} suspended={!!u.suspendedAt} openBookings={openBookings.length} />}
      />
      {u.suspendedAt && <div className="rise mb-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">Suspended {dateTime(u.suspendedAt)}: {u.suspendReason}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel title="Profile">
            <KV cols={3} items={[
              ['Phone', <span className="font-mono">{u.countryDialCode}{u.phoneNumber}</span>],
              ['Verified legal name', verifiedLegalName ?? <span className="text-muted-foreground">Not verified</span>],
              ['KYC submitted', dateTime(u.kycSubmittedAt)],
              ['Bookings', u.bookingCount], ['Disputes', u.disputeCount], ['Reviews', u.reviewCount],
            ]} />
          </Panel>
          <Panel title="Identity documents" description="ID numbers and dates of birth are never stored." flush><DocsTable docs={documents} targetType="user_document" /></Panel>
          <Panel title="Recent bookings" flush>
            {recentBookings.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No bookings.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Vendor · Vehicle</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recentBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell><Link to="/bookings/$id" params={{ id: b.id }} className="hover:underline"><Mono>{shortId(b.id)}</Mono></Link></TableCell>
                      <TableCell className="text-sm">{b.vendorName}<p className="text-xs text-muted-foreground">{b.vehicleName}</p></TableCell>
                      <TableCell className="text-xs">{dateTime(b.startTime)}</TableCell>
                      <TableCell><StatusPill value={b.status} /></TableCell>
                      <TableCell className="text-right tabular">{naira(b.totalInvoiceKobo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
        <div className="grid content-start gap-5">
          {wallet && (
            <Panel title="Wallet" actions={can('wallets.view') && <Link to="/money/wallets" search={{ user: id }} className="text-xs font-semibold text-primary hover:underline">Open wallet</Link>}>
              <p className="font-display text-2xl font-semibold tabular">{naira(wallet.balanceKobo)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{wallet.status === 'frozen' ? 'Frozen' : 'Active'} · {wallet.virtualAccountBank ?? 'No virtual account'} {wallet.virtualAccountNumber}</p>
            </Panel>
          )}
          <NotesPanel notes={notes} canAdd={can('accounts.notes')} pending={note.isPending} onAdd={(body) => note.mutateAsync({ id, body })} />
          <AuditTrail targetType="user" targetId={id} />
        </div>
      </div>
    </>
  )
}
