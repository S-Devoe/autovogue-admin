import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Empty, Filters, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUsers } from '@/services/people/people.api'
import { useUserStats } from '@/services/stats.api'
import { StatCards } from '@/components/common/stat-cards'
import { dateOnly } from '@/lib/format'

export const Route = createFileRoute('/_app/people/users/')({
  validateSearch: (s: Record<string, unknown>): { q?: string; verified?: string; suspended?: boolean } => ({
    q: typeof s.q === 'string' ? s.q : undefined, verified: typeof s.verified === 'string' ? s.verified : undefined,
    suspended: s.suspended === true || s.suspended === 'true' ? true : undefined,
  }),
  component: Users,
})

function Users() {
  const f = Route.useSearch()
  const nav = useNavigate({ from: '/people/users/' })
  const [term, setTerm] = useState(f.q ?? '')
  const q = useUsers(f)
  const stats = useUserStats()
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="People" title="Users" description="Search by name, email, phone or ID. Profiles are read only." />
      <StatCards
        loading={stats.isLoading}
        items={[
          { key: 'all', label: 'All users', value: stats.data?.total, active: !f.verified && !f.suspended, onClick: () => nav({ search: { q: f.q } }) },
          { key: 'verified', label: 'Verified', value: stats.data?.verified, active: f.verified === 'true' && !f.suspended, onClick: () => nav({ search: { q: f.q, verified: 'true' } }) },
          { key: 'not-verified', label: 'Not verified', value: stats.data?.notVerified, active: f.verified === 'false' && !f.suspended, onClick: () => nav({ search: { q: f.q, verified: 'false' } }) },
          { key: 'suspended', label: 'Suspended', value: stats.data?.suspended, tone: 'danger', active: !!f.suspended, onClick: () => nav({ search: { q: f.q, suspended: true } }) },
          { key: 'new', label: 'Joined this week', value: stats.data?.newThisWeek },
        ]}
      />
      <Panel flush>
        <Filters>
          <form className="relative w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); nav({ search: { ...f, q: term || undefined } }) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, email, phone or ID" className="pl-8" />
          </form>
          <NativeSelect aria-label="Filter by verification" value={f.verified ?? ''} onChange={(e) => nav({ search: { ...f, verified: e.target.value || undefined } })} className="w-44">
            <NativeSelectOption value="">Any verification</NativeSelectOption>
            <NativeSelectOption value="true">Verified</NativeSelectOption>
            <NativeSelectOption value="false">Not verified</NativeSelectOption>
          </NativeSelect>
        </Filters>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No users found" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>KYC</TableHead><TableHead>Account</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => nav({ to: '/people/users/$id', params: { id: u.id } })}>
                  <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.countryDialCode}{u.phoneNumber}</TableCell>
                  <TableCell>{u.isVerified ? <Pill tone="success">Verified</Pill> : <Pill>Not verified</Pill>}</TableCell>
                  <TableCell>{u.suspendedAt ? <Pill tone="danger">Suspended</Pill> : !u.isActivated ? <Pill tone="warning">Not activated</Pill> : <Pill tone="success">Active</Pill>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateOnly(u.createdAt)}</TableCell>
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
