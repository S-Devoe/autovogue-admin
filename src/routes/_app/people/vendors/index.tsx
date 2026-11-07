import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Empty, Filters, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTenants } from '@/services/people/people.api'
import { dateOnly, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/people/vendors/')({
  validateSearch: (s: Record<string, unknown>): { q?: string; type?: string; status?: string } => ({
    q: typeof s.q === 'string' ? s.q : undefined, type: typeof s.type === 'string' ? s.type : undefined, status: typeof s.status === 'string' ? s.status : undefined,
  }),
  component: Vendors,
})

function Vendors() {
  const f = Route.useSearch()
  const nav = useNavigate({ from: '/people/vendors/' })
  const [term, setTerm] = useState(f.q ?? '')
  const q = useTenants(f)
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="People" title="Vendors" description="Fleet partners and individual hosts. Cars only show on the marketplace once the vendor is verified." />
      <Panel flush>
        <Filters>
          <form className="relative w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); nav({ search: { ...f, q: term || undefined } }) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Business or host name, phone, staff email" className="pl-8" />
          </form>
          <NativeSelect aria-label="Filter by vendor type" value={f.type ?? ''} onChange={(e) => nav({ search: { ...f, type: e.target.value || undefined } })} className="w-44">
            <NativeSelectOption value="">All types</NativeSelectOption>
            <NativeSelectOption value="fleet_partner">Fleet partners</NativeSelectOption>
            <NativeSelectOption value="independent_host">Individual hosts</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-label="Filter by status" value={f.status ?? ''} onChange={(e) => nav({ search: { ...f, status: e.target.value || undefined } })} className="w-40">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="suspended">Suspended</NativeSelectOption>
          </NativeSelect>
        </Filters>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No vendors found" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Type</TableHead><TableHead>Owner</TableHead><TableHead>KYC/KYB</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Cars</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => nav({ to: '/people/vendors/$id', params: { id: t.id } })}>
                  <TableCell className="font-medium">{t.name || '-'}</TableCell>
                  <TableCell className="text-sm">{titleCase(t.tenantType)}</TableCell>
                  <TableCell className="text-sm">{t.ownerEmail || '-'}</TableCell>
                  <TableCell>{t.isVerified ? <Pill tone="success">Verified</Pill> : <Pill tone="warning">{titleCase(t.verificationStatus || 'unverified')}</Pill>}</TableCell>
                  <TableCell><StatusPill value={t.status} /></TableCell>
                  <TableCell className="text-right tabular">{t.vehicleCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateOnly(t.createdAt)}</TableCell>
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
