import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Timer } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDisputes } from '@/services/disputes/disputes.api'
import { age, naira, timeLeft, titleCase } from '@/lib/format'

type Tab = 'open' | 'mine' | 'unassigned' | 'resolved'
export const Route = createFileRoute('/_app/disputes/')({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; unassigned?: string; sla?: string } => ({
    tab: (s.unassigned ? 'unassigned' : typeof s.tab === 'string' ? s.tab : undefined) as Tab | undefined,
  }),
  component: Disputes,
})

export function SlaClock({ due, paused }: { due: string | null; paused?: string | null }) {
  if (!due) return <span className="text-muted-foreground">-</span>
  if (paused) return <Pill tone="info"><Timer className="size-3" /> Paused</Pill>
  const left = (new Date(due).getTime() - Date.now()) / 1000
  return <Pill tone={left < 0 ? 'danger' : left < 86400 ? 'warning' : 'neutral'}><Timer className="size-3" /> {timeLeft(left)}</Pill>
}

function Disputes() {
  const { tab = 'open' } = Route.useSearch()
  const nav = useNavigate({ from: '/disputes/' })
  const f = tab === 'mine' ? { assignee: 'me' } : tab === 'unassigned' ? { status: 'open', unassigned: true } : tab === 'resolved' ? { status: 'resolved' } : {}
  const q = useDisputes(f)
  const qPage = usePager(q)
  const rows = qPage.rows.filter((d) => tab !== 'open' || d.status === 'open' || d.status === 'under_review')
  return (
    <>
      <PageHeader eyebrow="Disputes" title="Dispute queue" description="Target: resolved within 72 hours. Oldest first. Requesting information pauses the clock." />
      <Tabs value={tab} onValueChange={(v) => nav({ search: { tab: v as Tab } })} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="mine">Assigned to me</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      <Panel flush>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No disputes here" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Raised by</TableHead><TableHead>User · Vendor</TableHead><TableHead>Status</TableHead><TableHead>Assignee</TableHead><TableHead>72h target</TableHead><TableHead className="text-right">At stake</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => nav({ to: '/disputes/$id', params: { id: d.id } })}>
                  <TableCell><p className="font-medium">{titleCase(d.category)}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{d.description}</p></TableCell>
                  <TableCell>{d.raisedBy === 'customer' ? 'User' : 'Vendor'}<p className="text-xs text-muted-foreground">{age(d.createdAt)} ago</p></TableCell>
                  <TableCell className="text-sm">{d.customerName}<p className="text-xs text-muted-foreground">{d.vendorName}</p></TableCell>
                  <TableCell><StatusPill value={d.status} /></TableCell>
                  <TableCell className="text-sm">{d.assigneeName ?? <span className="text-warning">Unassigned</span>}</TableCell>
                  <TableCell>{d.status === 'resolved' || d.status === 'closed' ? '-' : <SlaClock due={d.slaDueAt} paused={d.pausedAt} />}</TableCell>
                  <TableCell className="text-right tabular">{naira(d.totalInvoiceKobo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPage.pager}
      </Panel>
    </>
  )
}
