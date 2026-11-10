import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Empty, Filters, LoadMore, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  TICKET_CATEGORIES, TICKET_STATUS_LABEL, categoryLabel, requesterLabel, useSupportCounts, useSupportTickets,
  type RequesterType, type SupportCounts, type TicketFilters,
} from '@/services/support/support.api'
import { age } from '@/lib/format'

const TABS = {
  unassigned: { label: 'Unassigned', filter: { status: 'active', assignee: 'unassigned' }, count: (c: SupportCounts) => c.unassigned },
  mine: { label: 'Assigned to me', filter: { status: 'active', assignee: 'me' }, count: (c: SupportCounts) => c.mine },
  open: { label: 'Open', filter: { status: 'open' }, count: (c: SupportCounts) => c.open },
  in_progress: { label: 'In progress', filter: { status: 'in_progress' }, count: (c: SupportCounts) => c.inProgress },
  awaiting_reply: { label: 'Awaiting reply', filter: { status: 'awaiting_reply' }, count: (c: SupportCounts) => c.awaitingReply },
  closed: { label: 'Closed', filter: { status: 'closed' }, count: undefined },
  active: { label: 'All active', filter: { status: 'active' }, count: (c: SupportCounts) => c.open + c.inProgress + c.awaitingReply },
} satisfies Record<string, { label: string; filter: TicketFilters; count?: (c: SupportCounts) => number }>

type Tab = keyof typeof TABS

interface Search {
  tab?: Tab
  requesterType?: RequesterType
  category?: string
  q?: string
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export const Route = createFileRoute('/_app/support/')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: str(s.tab) && str(s.tab)! in TABS ? (s.tab as Tab) : undefined,
    requesterType: s.requesterType === 'user' || s.requesterType === 'tenant' ? s.requesterType : undefined,
    category: str(s.category),
    q: str(s.q),
  }),
  component: SupportQueue,
})

function SupportQueue() {
  const search = Route.useSearch()
  const { tab = 'unassigned' } = search
  const nav = useNavigate({ from: '/support/' })
  const set = (patch: Partial<Search>) => nav({ search: { ...search, ...patch } })
  const [term, setTerm] = useState(search.q ?? '')
  useEffect(() => setTerm(search.q ?? ''), [search.q])

  const counts = useSupportCounts()
  const q = useSupportTickets({ ...TABS[tab].filter, requesterType: search.requesterType, category: search.category, q: search.q })
  const rows = q.data?.pages.flatMap((p) => p.tickets) ?? []

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Questions from users and vendors. They only ever see replies from Autovogue Support, never your name. Latest activity first."
      />
      <Tabs value={tab} onValueChange={(v) => set({ tab: v as Tab })} className="mb-4">
        <TabsList className="flex-wrap">
          {(Object.keys(TABS) as Tab[]).map((k) => {
            const t = TABS[k]
            const n = counts.data && t.count ? t.count(counts.data) : undefined
            return (
              <TabsTrigger key={k} value={k}>
                {t.label}
                {n != null && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular text-muted-foreground">{n}</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
      <Panel flush>
        <Filters>
          <form className="relative w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); set({ q: term.trim() || undefined }) }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Subject or #REF" className="pl-8" aria-label="Search tickets" />
          </form>
          <NativeSelect aria-label="Filter by who asked" value={search.requesterType ?? ''} onChange={(e) => set({ requesterType: (e.target.value || undefined) as RequesterType | undefined })} className="w-40">
            <NativeSelectOption value="">Users and vendors</NativeSelectOption>
            <NativeSelectOption value="user">Users</NativeSelectOption>
            <NativeSelectOption value="tenant">Vendors</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-label="Filter by category" value={search.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })} className="w-40">
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {TICKET_CATEGORIES.map((c) => <NativeSelectOption key={c.value} value={c.value}>{c.label}</NativeSelectOption>)}
          </NativeSelect>
        </Filters>
        {q.isLoading ? <Rows n={8} /> : rows.length === 0 ? (
          <Empty title="No tickets here" hint={search.q || search.category || search.requesterType ? 'Try clearing the search or filters.' : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead><TableHead>Subject</TableHead><TableHead>From</TableHead><TableHead>Category</TableHead>
                <TableHead>Status</TableHead><TableHead>Assignee</TableHead><TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => nav({ to: '/support/$id', params: { id: t.id } })}>
                  <TableCell><Mono>{t.reference}</Mono></TableCell>
                  <TableCell><p className="max-w-72 truncate font-medium">{t.subject}</p></TableCell>
                  <TableCell className="text-sm">{t.requesterName || '-'}<p className="text-xs text-muted-foreground">{requesterLabel(t.requesterType)}</p></TableCell>
                  <TableCell className="text-sm">{categoryLabel(t.category)}</TableCell>
                  <TableCell><StatusPill value={t.status} label={TICKET_STATUS_LABEL[t.status]} /></TableCell>
                  <TableCell className="text-sm">{t.assignee?.name ?? <span className="text-warning">Unassigned</span>}</TableCell>
                  <TableCell className="text-xs">
                    {age(t.lastMessageAt)} ago
                    <p className="text-muted-foreground">{t.lastMessageBy === 'requester' ? `By the ${requesterLabel(t.requesterType).toLowerCase()}` : t.lastMessageBy === 'staff' ? 'By Support' : 'System'}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <LoadMore q={q} />
      </Panel>
    </>
  )
}
