import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, Search } from 'lucide-react'
import { Empty, Filters, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BOOKING_STATUSES, FUND_STATES, useBookings, type BookingFilters } from '@/services/bookings/bookings.api'
import { downloadCsv } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, shortId, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/bookings/')({
  validateSearch: (s: Record<string, unknown>): BookingFilters => ({
    q: typeof s.q === 'string' ? s.q : undefined,
    status: typeof s.status === 'string' ? s.status : undefined,
    fundState: typeof s.fundState === 'string' ? s.fundState : undefined,
    from: typeof s.from === 'string' ? s.from : undefined,
    to: typeof s.to === 'string' ? s.to : undefined,
  }),
  component: Bookings,
})

function Bookings() {
  const f = Route.useSearch()
  const navigate = useNavigate({ from: '/bookings/' })
  const { can } = useCan()
  const q = useBookings(f)
  const [term, setTerm] = useState(f.q ?? '')
  const { rows: rows, pager: qPager } = usePager(q)
  const set = (patch: Partial<BookingFilters>) => navigate({ search: { ...f, ...patch } })
  const statuses = BOOKING_STATUSES.filter((s) => can('bookings.view_unpaid') || (s !== 'PENDING_PAYMENT' && s !== 'PAYMENT_FAILED'))

  return (
    <>
      <PageHeader
        eyebrow="Bookings"
        title="All bookings"
        description={can('bookings.view_unpaid') ? 'Includes unpaid, failed and expired payments that vendors never see.' : 'Search every booking.'}
        actions={can('exports.ops', 'exports.all') && (
          <Button variant="outline" onClick={() => downloadCsv(API_ENDPOINTS.BOOKINGS, { ...f, format: 'csv' }, 'bookings.csv')}><Download /> Export CSV</Button>
        )}
      />
      <Panel flush>
        <Filters>
          <form className="relative w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); set({ q: term || undefined }) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Reference, user, vendor, plate" className="pl-8" />
          </form>
          <NativeSelect aria-label="Filter by booking status" value={f.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} className="w-44">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {statuses.map((s) => <NativeSelectOption key={s} value={s}>{titleCase(s)}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect aria-label="Filter by money state" value={f.fundState ?? ''} onChange={(e) => set({ fundState: e.target.value || undefined })} className="w-44">
            <NativeSelectOption value="">Any fund state</NativeSelectOption>
            {FUND_STATES.map((s) => <NativeSelectOption key={s} value={s}>{titleCase(s)}</NativeSelectOption>)}
          </NativeSelect>
          <Input type="date" value={f.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className="w-40" aria-label="Start date from" />
          <Input type="date" value={f.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className="w-40" aria-label="Start date to" />
        </Filters>
        {q.isLoading ? <Rows n={10} /> : rows.length === 0 ? <Empty title="No bookings match" hint="Try a different reference, name or status." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead><TableHead>User</TableHead><TableHead>Vendor · Vehicle</TableHead><TableHead>Trip (WAT)</TableHead>
                <TableHead>Status</TableHead><TableHead>Funds</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate({ to: '/bookings/$id', params: { id: b.id } })}>
                  <TableCell><Mono>{shortId(b.id)}</Mono></TableCell>
                  <TableCell><p className="font-medium">{b.customerName}</p><p className="text-xs text-muted-foreground">{b.customerEmail}</p></TableCell>
                  <TableCell><p>{b.vendorName}</p><p className="text-xs text-muted-foreground">{b.vehicleName} · <span className="font-mono">{b.licensePlate}</span></p></TableCell>
                  <TableCell className="text-xs">{dateTime(b.startTime)}<p className="text-muted-foreground">to {dateTime(b.endTime)}</p></TableCell>
                  <TableCell><StatusPill value={b.status} /></TableCell>
                  <TableCell><StatusPill value={b.fundState} />{b.payoutHeldAt && <p className="mt-1 text-[11px] font-semibold text-warning">Payout on hold</p>}</TableCell>
                  <TableCell className="text-right font-medium tabular">{naira(b.totalInvoiceKobo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
    </>
  )
}
