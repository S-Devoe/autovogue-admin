import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { EyeOff, Flag, MessageSquareLock, RotateCcw, Star } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { ChatThread } from '@/components/common/chat-thread'
import { openReviewChat, type ChatMessage } from '@/services/disputes/disputes.api'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReviewAction, useReviews, type ReviewRow } from '@/services/listings/listings.api'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCan } from '@/hooks/use-can'

export const Route = createFileRoute('/_app/trust/reviews')({ component: Reviews })

function Reviews() {
  const { can } = useCan()
  const [chatFor, setChatFor] = useState<string | null>(null)
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({})
  const [filter, setFilter] = useState<'queue' | 'hidden' | 'all'>('queue')
  const q = useReviews(filter)
  const act = useReviewAction()
  const [target, setTarget] = useState<{ r: ReviewRow; action: 'hide' | 'restore' } | null>(null)
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="Trust" title="Review moderation" description="Reported reviews and 1-2 star reviews. A hidden review stops counting toward the car's rating." />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList><TabsTrigger value="queue">Needs a look</TabsTrigger><TabsTrigger value="hidden">Hidden</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
      </Tabs>
      <Panel flush>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="Nothing to moderate" /> : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className={cn('grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]', r.hiddenAt && 'opacity-70')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('size-3.5', i < r.rating ? 'fill-warning text-warning' : 'text-border')} />)}</span>
                    <span className="text-sm font-semibold">{r.customerName}</span>
                    <span className="text-xs text-muted-foreground">on <Link to="/listings/$id" params={{ id: r.vehicleId }} className="hover:underline">{r.vehicleName}</Link> · {r.vendorName} · {dateTime(r.createdAt)}</span>
                    {r.reportedAt && <Pill tone="warning"><Flag className="size-3" /> Reported{r.reportReason && `: ${r.reportReason}`}</Pill>}
                    {r.hiddenAt && <Pill tone="danger">Hidden: {r.hiddenReason}</Pill>}
                  </div>
                  <p className="mt-1.5 text-sm">{r.comment || <span className="text-muted-foreground">No comment</span>}</p>
                  {r.vendorReply && <p className="mt-2 border-l-2 pl-3 text-xs text-muted-foreground">Vendor reply: {r.vendorReply}</p>}
                  {chats[r.id] && <div className="mt-3 rounded-lg border p-3"><ChatThread messages={chats[r.id]} /></div>}
                </div>
                <div className="flex items-start gap-2">
                  {r.reportedAt && can('disputes.view_chat') && (
                    <Button size="sm" variant="outline" onClick={() => setChatFor(r.id)}><MessageSquareLock /> Booking chat</Button>
                  )}
                  {r.hiddenAt
                    ? <Button size="sm" variant="outline" onClick={() => setTarget({ r, action: 'restore' })}><RotateCcw /> Restore</Button>
                    : <Button size="sm" variant="outline" className="text-danger" onClick={() => setTarget({ r, action: 'hide' })}><EyeOff /> Hide</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {qPager}
      </Panel>
      <ReasonDialog open={!!chatFor} onOpenChange={(o) => !o && setChatFor(null)} title="Open the booking chat"
        consequence="Private messages between the user and vendor on this booking. Your name, the time and this reason are logged." confirmLabel="Open chat"
        onConfirm={async (reason) => { const id = chatFor!; const m = await openReviewChat(id, reason); setChats((c) => ({ ...c, [id]: m })); setChatFor(null) }} />
      <ReasonDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} destructive={target?.action === 'hide'} title={target?.action === 'hide' ? 'Hide this review' : 'Restore this review'}
        confirmLabel={target?.action === 'hide' ? 'Hide review' : 'Restore'} pending={act.isPending}
        consequence={target?.action === 'hide' ? 'It disappears from the app and stops counting toward ratings.' : 'It shows again and counts toward ratings.'}
        onConfirm={(reason) => act.mutateAsync({ id: target!.r.id, action: target!.action, reason }).then(() => setTarget(null))} />
    </>
  )
}
