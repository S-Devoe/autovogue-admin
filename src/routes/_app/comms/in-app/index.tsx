import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Empty, KV, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { InAppCard } from '@/components/comms/in-app-bits'
import { StatusPill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AUDIENCES, useInAppMessages, useSetInAppStatus, type InAppMessage } from '@/services/comms/in-app.api'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/comms/in-app/')({ component: InAppList })

type Action = 'live' | 'paused' | 'ended'

const ACTIONS: Record<Action, { label: string; title: string; consequence: string; danger?: boolean }> = {
  live: { label: 'Go live', title: 'Go live', consequence: 'Everyone in the audience sees it once, the next time they open the app.' },
  paused: { label: 'Pause', title: 'Pause', consequence: 'Nobody new sees it until you make it live again. People who saw it are not affected.' },
  ended: { label: 'End', title: 'End', consequence: "It stops for good and can't be made live again.", danger: true },
}

function actionsFor(m: InAppMessage): Action[] {
  switch (m.status) {
    case 'draft': return ['live', 'ended']
    case 'live': return ['paused', 'ended']
    case 'paused': return ['live', 'ended']
    default: return []
  }
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '-')

function InAppList() {
  const q = useInAppMessages()
  const { rows, pager } = usePager(q)
  const { can } = useCan()
  const setStatus = useSetInAppStatus()
  const [confirm, setConfirm] = useState<{ m: InAppMessage; action: Action } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Read from the list so the dialog shows fresh numbers and status.
  const open = rows.find((r) => r.id === openId) ?? null

  return (
    <>
      <PageHeader eyebrow="Comms" title="In-app messages"
        description="A full-screen card people see once when they next open the AutoVogue app, the vendor dashboard or this admin. Expired messages never show."
        actions={can('broadcasts.draft') && (
          <Button render={<Link to="/comms/in-app/new" />} nativeButton={false}><Plus /> New message</Button>
        )} />
      <Panel flush>
        {q.isLoading ? <Rows /> : !rows.length ? <Empty title="No in-app messages yet" hint="Create one to welcome people, announce a feature or share an offer." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead><TableHead>Audience</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Seen</TableHead><TableHead className="text-right">Clicked</TableHead>
                <TableHead>Runs</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="size-6 shrink-0 rounded-md border" style={{ backgroundColor: m.backgroundColor }} aria-hidden />
                      <button type="button" onClick={() => setOpenId(m.id)} className="min-w-0 text-left">
                        <span className="font-medium hover:underline">{m.title}</span>
                        <p className="max-w-80 truncate text-xs text-muted-foreground">{m.body}</p>
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{AUDIENCES.find((a) => a.value === m.audience)?.label}</TableCell>
                  <TableCell><StatusPill value={m.status} /></TableCell>
                  <TableCell className="text-right tabular">{m.seen.toLocaleString('en-NG')}</TableCell>
                  <TableCell className="text-right tabular">
                    {m.ctaLabel ? <>{m.clicked.toLocaleString('en-NG')} <span className="text-muted-foreground">({pct(m.clicked, m.seen)})</span></> : <span className="text-muted-foreground">No button</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.startsAt ? dateTime(m.startsAt) : 'When live'}
                    {' to '}
                    {m.endsAt ? dateTime(m.endsAt) : 'no end'}
                  </TableCell>
                  <TableCell className="text-right">
                    {can('broadcasts.send') && (
                      <div className="flex justify-end gap-1.5">
                        {actionsFor(m).map((a) => (
                          <Button key={a} size="sm" variant={a === 'live' ? 'default' : 'outline'} onClick={() => setConfirm({ m, action: a })}>
                            {ACTIONS[a].label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {pager}
      </Panel>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">{open.title} <StatusPill value={open.status} /></DialogTitle>
                <DialogDescription>{AUDIENCES.find((a) => a.value === open.audience)?.hint}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="self-start rounded-2xl bg-black/60 p-4">
                  <InAppCard title={open.title} body={open.body} imageUrl={open.imageUrl} ctaLabel={open.ctaLabel} backgroundColor={open.backgroundColor} compact />
                </div>
                <div className="grid content-start gap-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {([['Seen', open.seen], ['Clicked', open.clicked], ['Closed', open.dismissed]] as const).map(([k, v]) => (
                      <div key={k} className="rounded-xl border p-3">
                        <p className="text-xl font-semibold tabular">{v.toLocaleString('en-NG')}</p>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
                      </div>
                    ))}
                  </div>
                  <KV cols={2} items={[
                    ['Audience', AUDIENCES.find((a) => a.value === open.audience)?.label],
                    ['Click rate', open.ctaLabel ? pct(open.clicked, open.seen) : 'No button'],
                    ['Starts', open.startsAt ? dateTime(open.startsAt) : 'When live'],
                    ['Expires', open.endsAt ? dateTime(open.endsAt) : 'No end'],
                    ['Button', open.ctaLabel ?? 'None'],
                    ['Colour', <span key="c" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm border" style={{ backgroundColor: open.backgroundColor }} />{open.backgroundColor}</span>],
                    ['Created', dateTime(open.createdAt)],
                    ['Created by', open.createdByName || open.createdBy],
                  ]} />
                  {open.ctaUrl && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Button opens</p>
                      <p className="break-all text-sm">{open.ctaUrl}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Message</p>
                    <p className="whitespace-pre-line text-sm">{open.body}</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {(open.status === 'draft' || open.status === 'paused') && can('broadcasts.draft') && (
                  <Button variant="outline" render={<Link to="/comms/in-app/$id" params={{ id: open.id }} />} nativeButton={false}>Edit</Button>
                )}
                {can('broadcasts.send') && actionsFor(open).map((a) => (
                  <Button key={a} variant={a === 'live' ? 'default' : 'outline'} onClick={() => { setOpenId(null); setConfirm({ m: open, action: a }) }}>
                    {ACTIONS[a].label}
                  </Button>
                ))}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm && `${ACTIONS[confirm.action].title}: ${confirm.m.title}`}</DialogTitle>
            <DialogDescription>{confirm && ACTIONS[confirm.action].consequence}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm && ACTIONS[confirm.action].danger ? 'destructive' : 'default'} disabled={setStatus.isPending}
              onClick={() => confirm && setStatus.mutateAsync({ id: confirm.m.id, status: confirm.action }).then(() => setConfirm(null))}>
              {confirm && ACTIONS[confirm.action].label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
