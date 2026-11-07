import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Empty, PageHeader, Panel, Rows } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, useCharts } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { useCan } from '@/hooks/use-can'
import { naira, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/reports/')({ component: Reports })

// One series per chart, one hue (chart-1), one axis: each chart answers one question.
const bookingsCfg = { bookings: { label: 'Bookings', color: 'var(--chart-1)' } } satisfies ChartConfig
const valueCfg = { value: { label: 'Paid value', color: 'var(--chart-1)' } } satisfies ChartConfig
const compact = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 })
const shortDay = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

const RANGES = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '365d': 'Last 12 months' } as const

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Reports() {
  const [range, setRange] = useState<keyof typeof RANGES>('30d')
  const q = useCharts(range)
  const { can } = useCan()
  const d = q.data
  const from = new Date(Date.now() - Number(range.replace('d', '')) * 86400e3).toISOString()
  const to = new Date().toISOString()
  const exp = (kind: string) => downloadCsv(API_ENDPOINTS.exportKind(kind), { from, to }, `${kind}-${range}.csv`)
  const byDay = d?.byDay.map((r) => ({ day: r.day, bookings: r.bookings, value: r.valueKobo / 100 })) ?? []
  const totalBookings = d?.byDay.reduce((a, r) => a + r.bookings, 0) ?? 0
  const totalValue = d?.byDay.reduce((a, r) => a + r.valueKobo, 0) ?? 0
  const funnel = d ? [
    { step: 'Signed up', n: d.funnel.signedUp },
    { step: 'Submitted ID', n: d.funnel.submitted },
    { step: 'Verified', n: d.funnel.verified },
    { step: 'Booked', n: d.funnel.booked },
  ] : []

  return (
    <>
      <PageHeader eyebrow="Reports" title="How the marketplace is doing" description="Times in WAT. Paid value counts confirmed bookings only."
        actions={
          <>
            <NativeSelect value={range} onChange={(e) => setRange(e.target.value as keyof typeof RANGES)} className="w-40" aria-label="Date range">
              {Object.entries(RANGES).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v}</NativeSelectOption>)}
            </NativeSelect>
            {can('exports.money', 'exports.all') && <>
              <Button size="sm" variant="outline" onClick={() => exp('payments')}><Download /> Payments</Button>
              <Button size="sm" variant="outline" onClick={() => exp('payouts')}><Download /> Payouts</Button>
              <Button size="sm" variant="outline" onClick={() => exp('refunds')}><Download /> Refunds</Button>
            </>}
            {can('exports.ops', 'exports.all') && <Button size="sm" variant="outline" onClick={() => exp('verifications')}><Download /> Verifications</Button>}
          </>
        } />
      {q.isLoading ? <Rows /> : !d ? <Empty title="No data" /> : (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bookings" value={totalBookings.toLocaleString('en-NG')} />
            <Stat label="Paid value" value={naira(totalValue)} />
            <Stat label="Trips completed" value={d.trips.toLocaleString('en-NG')} />
            <Stat label="Disputes per 100 trips" value={d.disputesPer100Trips.toFixed(1)} hint={`${d.disputes} dispute(s)`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Bookings per day">
              <ChartContainer config={bookingsCfg} className="h-56 w-full">
                <BarChart data={byDay} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={shortDay} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />} />
                  <Bar dataKey="bookings" fill="var(--color-bookings)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </Panel>
            <Panel title="Paid value per day (₦)">
              <ChartContainer config={valueCfg} className="h-56 w-full">
                <LineChart data={byDay} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={shortDay} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => compact.format(v)} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} formatter={(v) => naira(Number(v) * 100)} />} />
                  <Line dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Verification funnel" description="People who signed up in the range, and how far they got.">
              <ChartContainer config={{ n: { label: 'People', color: 'var(--chart-1)' } }} className="h-56 w-full">
                <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="step" tickLine={false} axisLine={false} width={92} />
                  <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="n" fill="var(--color-n)" radius={[0, 4, 4, 0]} maxBarSize={26} />
                </BarChart>
              </ChartContainer>
            </Panel>
            <Panel title="By state" flush>
              <BreakdownTable rows={d.byState.map((r) => ({ name: r.state || 'Unknown', bookings: r.bookings, valueKobo: r.valueKobo }))} />
            </Panel>
            <Panel title="By vendor type" flush>
              <BreakdownTable rows={d.byVendorType.map((r) => ({ name: titleCase(r.vendorType), bookings: r.bookings, valueKobo: r.valueKobo }))} />
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}

function BreakdownTable({ rows }: { rows: { name: string; bookings: number; valueKobo: number }[] }) {
  if (!rows.length) return <Empty title="No bookings yet" />
  return (
    <Table>
      <TableHeader><TableRow><TableHead /><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Paid value</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell className="text-right tabular">{r.bookings}</TableCell>
            <TableCell className="text-right tabular">{naira(r.valueKobo)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
