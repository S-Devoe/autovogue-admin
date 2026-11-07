import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Car, Search, Star } from 'lucide-react'
import { Empty, Filters, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { useVehicles } from '@/services/listings/listings.api'
import { naira } from '@/lib/format'

export const Route = createFileRoute('/_app/listings/')({
  validateSearch: (s: Record<string, unknown>): { q?: string; status?: string; state?: string; takenDown?: boolean } => ({
    q: typeof s.q === 'string' ? s.q : undefined, status: typeof s.status === 'string' ? s.status : undefined,
    state: typeof s.state === 'string' ? s.state : undefined, takenDown: s.takenDown === true || s.takenDown === 'true' ? true : undefined,
  }),
  component: Listings,
})

const STATES = ['Lagos', 'Abuja', 'Rivers', 'Oyo', 'Kano', 'Enugu', 'Delta', 'Ogun', 'Kaduna', 'Edo']

function Listings() {
  const f = Route.useSearch()
  const nav = useNavigate({ from: '/listings/' })
  const [term, setTerm] = useState(f.q ?? '')
  const q = useVehicles(f)
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="Listings" title="All cars" description="Every listing across vendors. Take a listing down with a reason the vendor sees." />
      <Panel flush>
        <Filters>
          <form className="relative w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); nav({ search: { ...f, q: term || undefined } }) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Plate, make, model or vendor" className="pl-8" />
          </form>
          <NativeSelect aria-label="Filter by status" value={f.status ?? ''} onChange={(e) => nav({ search: { ...f, status: e.target.value || undefined } })} className="w-40">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {['AVAILABLE', 'RENTED', 'MAINTENANCE', 'CLEANING', 'DRAFT', 'RETIRED'].map((s) => <NativeSelectOption key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect aria-label="Filter by state" value={f.state ?? ''} onChange={(e) => nav({ search: { ...f, state: e.target.value || undefined } })} className="w-36">
            <NativeSelectOption value="">Any state</NativeSelectOption>
            {STATES.map((s) => <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>)}
          </NativeSelect>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={!!f.takenDown} onCheckedChange={(v) => nav({ search: { ...f, takenDown: v || undefined } })} /> Taken down only</label>
        </Filters>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No listings match" icon={<Car className="size-5" />} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map((v) => (
              <Link key={v.id} to="/listings/$id" params={{ id: v.id }} className="group overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-[16/10] bg-muted">
                  {v.coverPhoto ? <img src={v.coverPhoto} alt="" loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground"><Car className="size-8" /></div>}
                  <div className="absolute left-2 top-2 flex gap-1">
                    {v.takenDownAt && <Pill tone="danger" className="bg-danger text-white">Taken down</Pill>}
                    {!v.isBookable && !v.takenDownAt && <Pill className="bg-card/90">Not bookable</Pill>}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{v.make} {v.model} <span className="font-normal text-muted-foreground">{v.year}</span></p>
                    <StatusPill value={v.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{v.vendorName} · {v.locationState ?? 'No state'} · <span className="font-mono">{v.licensePlate}</span></p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium tabular">{v.customDailyRateKobo ? `${naira(v.customDailyRateKobo)}/day` : 'Group pricing'}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="size-3.5 fill-current text-warning" /> {v.rating ? v.rating.toFixed(1) : '-'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {qPager}
      </Panel>
    </>
  )
}
