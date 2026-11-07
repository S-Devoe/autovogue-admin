import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Lock } from 'lucide-react'
import { Empty, Filters, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, useAudit, type AuditEntry, type AuditFilters } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/audit')({
  validateSearch: (s: Record<string, unknown>): AuditFilters => Object.fromEntries(
    ['staffId', 'targetType', 'targetId', 'action', 'from', 'to'].filter((k) => typeof s[k] === 'string').map((k) => [k, s[k] as string]),
  ),
  component: Audit,
})

function Audit() {
  const f = Route.useSearch()
  const nav = Route.useNavigate()
  const { can } = useCan()
  const q = useAudit(f)
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const { rows: rows, pager: qPager } = usePager(q)
  const set = (k: keyof AuditFilters, v: string) => nav({ search: { ...f, [k]: v || undefined } })
  return (
    <>
      <PageHeader eyebrow="Settings" title="Audit log"
        description={<span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Append only: nobody can edit or delete entries, super admins included. {can('audit.view_all') ? 'You see every entry.' : 'You see your own actions.'}</span>}
        actions={can('audit.export') && <Button variant="outline" onClick={() => downloadCsv(API_ENDPOINTS.AUDIT_EXPORT, f as Record<string, unknown>, 'audit-log.csv')}><Download /> Export CSV</Button>} />
      <Panel flush>
        <Filters>
          <Input defaultValue={f.action} onBlur={(e) => set('action', e.target.value)} placeholder="Action contains (e.g. refunds, files.view)" className="w-64" />
          <Input defaultValue={f.targetType} onBlur={(e) => set('targetType', e.target.value)} placeholder="Target type" className="w-36" />
          <Input defaultValue={f.targetId} onBlur={(e) => set('targetId', e.target.value)} placeholder="Target ID" className="w-56 font-mono" />
          {can('audit.view_all') && <Input defaultValue={f.staffId} onBlur={(e) => set('staffId', e.target.value)} placeholder="Staff ID" className="w-56 font-mono" />}
          <Input type="date" value={f.from ?? ''} onChange={(e) => set('from', e.target.value)} className="w-40" aria-label="From" />
          <Input type="date" value={f.to ?? ''} onChange={(e) => set('to', e.target.value)} className="w-40" aria-label="To" />
        </Filters>
        {q.isLoading ? <Rows n={12} /> : rows.length === 0 ? <Empty title="No entries match" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>When (WAT)</TableHead><TableHead>Staff</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Reason</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => setOpen(a)}>
                  <TableCell className="whitespace-nowrap text-xs">{dateTime(a.createdAt)}</TableCell>
                  <TableCell className="text-sm">{a.staffEmail ?? 'system'}</TableCell>
                  <TableCell><Mono>{a.action}</Mono></TableCell>
                  <TableCell className="text-xs">{a.targetType}<p className="font-mono text-muted-foreground">{a.targetId?.slice(-12)}</p></TableCell>
                  <TableCell className="max-w-72 truncate text-xs text-muted-foreground">{a.reason ?? '-'}</TableCell>
                  <TableCell>{a.statusCode ? <Pill tone={a.statusCode >= 400 ? 'danger' : a.statusCode === 202 ? 'info' : 'success'} dot={false}>{a.statusCode}</Pill> : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="font-mono text-base">{open?.action}</SheetTitle>
            <SheetDescription>{open && dateTime(open.createdAt)} WAT · {open?.staffEmail ?? 'system'}</SheetDescription>
          </SheetHeader>
          {open && (
            <div className="grid gap-3 px-4 pb-6 text-sm">
              {[['Target', `${open.targetType ?? '-'} ${open.targetId ?? ''}`], ['Reason', open.reason ?? '-'], ['Result', open.statusCode ?? '-'], ['IP', open.ip ?? '-'], ['Request ID', open.requestId ?? '-'], ['Browser', open.userAgent ?? '-']].map(([k, v]) => (
                <div key={k as string}><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p><p className="break-all">{v}</p></div>
              ))}
              {open.before != null && <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Before</p><pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(open.before, null, 2)}</pre></div>}
              {open.after != null && <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">After</p><pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(open.after, null, 2)}</pre></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
