import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Empty, Filters, PageHeader, Panel, Rows } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLedger } from '@/services/money/money.api'
import { downloadCsv } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { useCan } from '@/hooks/use-can'
import { naira } from '@/lib/format'

export const Route = createFileRoute('/_app/money/ledger')({ component: Ledger })

const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

function Ledger() {
  const { can } = useCan()
  const now = new Date()
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(ymd(new Date(now.getTime() + 864e5)))
  const q = useLedger(from, to)
  const rows = q.data ?? []
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0)
  return (
    <>
      <PageHeader eyebrow="Money" title="Commission ledger" description="Commission and payouts per vendor for paid bookings created in the period (WAT dates, end date exclusive)."
        actions={can('exports.money', 'exports.all') && <Button variant="outline" onClick={() => downloadCsv(API_ENDPOINTS.LEDGER, { from, to, format: 'csv' }, `commission-${from}-${to}.csv`)}><Download /> Export CSV</Button>} />
      <Panel flush>
        <Filters>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" />
        </Filters>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No paid bookings in this period" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">Commission</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">AutoVogue net</TableHead><TableHead className="text-right">Vendor payout</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.tenantId}>
                  <TableCell><Link to="/people/vendors/$id" params={{ id: r.tenantId }} className="hover:underline">{r.vendorName}</Link></TableCell>
                  <TableCell className="text-right tabular">{r.bookings}</TableCell>
                  <TableCell className="text-right tabular">{naira(r.baseKobo)}</TableCell>
                  <TableCell className="text-right tabular">{naira(r.commissionKobo)}</TableCell>
                  <TableCell className="text-right tabular">{naira(r.vatKobo)}</TableCell>
                  <TableCell className="text-right font-medium tabular">{naira(r.netKobo)}</TableCell>
                  <TableCell className="text-right tabular">{naira(r.vendorPayoutKobo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular">{sum('bookings')}</TableCell>
                <TableCell className="text-right tabular">{naira(sum('baseKobo'))}</TableCell>
                <TableCell className="text-right tabular">{naira(sum('commissionKobo'))}</TableCell>
                <TableCell className="text-right tabular">{naira(sum('vatKobo'))}</TableCell>
                <TableCell className="text-right tabular">{naira(sum('netKobo'))}</TableCell>
                <TableCell className="text-right tabular">{naira(sum('vendorPayoutKobo'))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>
    </>
  )
}
