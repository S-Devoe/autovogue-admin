import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, X } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApprovals, useDecideApproval, type Approval } from '@/services/settings/settings.api'
import { dateTime, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/approvals')({ component: Approvals })

function Approvals() {
  const [status, setStatus] = useState('pending')
  const q = useApprovals(status)
  const decide = useDecideApproval()
  const [target, setTarget] = useState<{ a: Approval; approve: boolean } | null>(null)
  const [note, setNote] = useState('')
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="Settings" title="Approvals" description="Two-person approval for money settings, commission overrides, sensitive roles, large refunds and payouts, and suspension requests. You can never approve your own." />
      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList><TabsTrigger value="pending">Waiting</TabsTrigger><TabsTrigger value="approved">Approved</TabsTrigger><TabsTrigger value="rejected">Rejected</TabsTrigger><TabsTrigger value="failed">Failed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
      </Tabs>
      <Panel flush>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="Nothing waiting" /> : (
          <ul className="divide-y">
            {rows.map((a) => (
              <li key={a.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{a.summary} <Pill tone="brand" dot={false}>{titleCase(a.kind.replace('.', ' '))}</Pill> <StatusPill value={a.status} /></p>
                  <p className="mt-1 text-sm">"{a.reason}"</p>
                  <p className="mt-1 text-xs text-muted-foreground">Proposed by {a.proposedByName} · {dateTime(a.createdAt)} · needs {a.approvePermission}</p>
                  {a.decidedByName && <p className="text-xs text-muted-foreground">{titleCase(a.status)} by {a.decidedByName} {dateTime(a.decidedAt)}{a.decisionNote && `: ${a.decisionNote}`}</p>}
                  {a.failure && <p className="mt-1 text-xs text-danger">Applying failed: {a.failure}</p>}
                </div>
                {a.status === 'pending' && (
                  a.canDecide ? (
                    <div className="flex items-start gap-2">
                      <Button size="sm" variant="outline" className="text-danger" onClick={() => setTarget({ a, approve: false })}><X /> Reject</Button>
                      <Button size="sm" className="bg-success text-white hover:bg-success/90" onClick={() => setTarget({ a, approve: true })}><Check /> Approve</Button>
                    </div>
                  ) : <p className="self-center text-xs text-muted-foreground">Someone else must decide</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {qPager}
      </Panel>
      <Dialog open={!!target} onOpenChange={(o) => { if (!o) { setTarget(null); setNote('') } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{target?.approve ? 'Approve and apply' : 'Reject'}</DialogTitle>
            <DialogDescription>{target?.a.summary}. {target?.approve ? 'It applies as soon as you approve.' : 'The proposer sees your note.'}</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={target?.approve ? 'Optional note' : 'Why (required, 5+ characters)'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button disabled={decide.isPending || (!target?.approve && note.trim().length < 5)} className={target?.approve ? 'bg-success text-white hover:bg-success/90' : 'bg-danger text-white hover:bg-danger/90'}
              onClick={() => decide.mutateAsync({ id: target!.a.id, approve: target!.approve, note: note.trim() }).then(() => { setTarget(null); setNote('') })}>
              {target?.approve ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
