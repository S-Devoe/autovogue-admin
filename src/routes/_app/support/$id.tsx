import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Lock, RefreshCw, Send, StickyNote, UserCheck, XCircle } from 'lucide-react'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  TICKET_STATUS_LABEL, categoryLabel, requesterLabel, useAssignTicket, useReplyToTicket, useSetTicketStatus, useSupportAssignees, useSupportTicket,
  type AdminTicketDetail, type AdminTicketMessage, type TicketStatus,
} from '@/services/support/support.api'
import type { ApiError } from '@/services/types'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/support/$id')({ component: TicketPage })

/** Poll for new messages for this long after opening (or refreshing), then stop. */
const POLL_WINDOW_MS = 10 * 60_000
const MAX_BODY = 5000

function TicketPage() {
  const { id } = Route.useParams()
  const { can, me } = useCan()
  const [windowStart, setWindowStart] = useState(() => Date.now())
  const [polling, setPolling] = useState(true)
  useEffect(() => {
    setPolling(true)
    const t = setTimeout(() => setPolling(false), POLL_WINDOW_MS - (Date.now() - windowStart))
    return () => clearTimeout(t)
  }, [windowStart])

  const q = useSupportTicket(id, polling)
  const restartWindow = () => setWindowStart(Date.now())
  const refresh = () => { restartWindow(); void q.refetch() }

  if (q.isLoading || !q.data) return <Rows n={10} />
  const t = q.data
  const closed = t.status === 'closed'
  const who = requesterLabel(t.requesterType).toLowerCase()
  const canReply = can('support.reply') && !closed
  const canAssign = can('support.assign') && !closed

  /** A write on a ticket closed meanwhile: the API says TICKET_CLOSED (already toasted); show the closed ticket. */
  const onWriteError = (e: unknown) => {
    if ((e as ApiError)?.code === 'TICKET_CLOSED') void q.refetch()
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Support', to: '/support' }]}
        eyebrow={`Ticket ${t.reference}`}
        title={<span className="flex flex-wrap items-center gap-3">{t.subject} <StatusPill value={t.status} label={TICKET_STATUS_LABEL[t.status]} /></span>}
        description={<>{categoryLabel(t.category)} · opened {dateTime(t.createdAt)}{closed && t.closedAt && <> · closed {dateTime(t.closedAt)}{t.closedBy && ` by ${t.closedBy === 'requester' ? `the ${who}` : t.closedBy === 'staff' ? 'Support' : 'the system'}`}</>}</>}
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={q.isFetching}><RefreshCw className={cn(q.isFetching && 'animate-spin')} /> Refresh</Button>
            {canAssign && <AssignActions ticket={t} meId={me?.id} onError={onWriteError} />}
            {canReply && <StatusActions ticket={t} onError={onWriteError} />}
          </>
        }
      />
      {!polling && !closed && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Auto refresh paused after 10 minutes. Click <strong>Refresh</strong> to check for new messages.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-5">
          <Panel title="Conversation" description={`The ${who} sees staff replies as "Autovogue Support". Internal notes are never shown to them.`}>
            <Conversation messages={t.messages} who={who} />
          </Panel>
          {closed ? (
            <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"><Lock className="size-4" /> This ticket is closed. Nobody can reply to it any more. The {who} has to open a new ticket if they still need help.</p>
          ) : canReply ? (
            <Composer ticket={t} who={who} onSent={restartWindow} onError={onWriteError} />
          ) : null}
        </div>
        <div className="grid content-start gap-5">
          <Panel title={`From the ${who}`}>
            <KV cols={1} items={[
              ['Name', can('accounts.view') && t.requesterName ? (
                t.requesterType === 'tenant'
                  ? <Link to="/people/vendors/$id" params={{ id: t.requesterId }} className="hover:underline">{t.requesterName}</Link>
                  : <Link to="/people/users/$id" params={{ id: t.requesterId }} className="hover:underline">{t.requesterName}</Link>
              ) : (t.requesterName || '-')],
              ['Type', requesterLabel(t.requesterType)],
              ['Email', t.requesterEmail || '-'],
              ...(t.requesterType === 'tenant' && t.openedByName ? [['Opened by', `${t.openedByName} (vendor team member)`] as [string, React.ReactNode]] : []),
              ['Booking', t.bookingId && t.bookingReference
                ? (can('bookings.view') ? <Link to="/bookings/$id" params={{ id: t.bookingId }} className="hover:underline"><Mono>{t.bookingReference}</Mono></Link> : <Mono>{t.bookingReference}</Mono>)
                : 'Not linked to a booking'],
            ]} />
          </Panel>
          <Panel title="Ticket">
            <KV cols={1} items={[
              ['Reference', <Mono>{t.reference}</Mono>],
              ['Category', categoryLabel(t.category)],
              ['Assignee', t.assignee?.name ?? <span className="text-warning">Unassigned</span>],
              ['Last activity', dateTime(t.lastMessageAt)],
            ]} />
            {t.status === 'awaiting_reply' && (
              <p className="mt-3 rounded-md bg-info-soft px-3 py-2 text-xs text-info">Waiting for the {who}. If they don't reply within 7 days, the ticket closes on its own.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

function Conversation({ messages, who }: { messages: AdminTicketMessage[]; who: string }) {
  if (!messages.length) return <p className="text-sm text-muted-foreground">No messages yet.</p>
  return (
    <ol className="grid gap-3">
      {messages.map((m) => {
        if (m.from === 'system') {
          return (
            <li key={m.id} className="justify-self-center px-4 text-center text-xs text-muted-foreground">
              {m.body} <span className="opacity-70">· {dateTime(m.createdAt)}</span>
            </li>
          )
        }
        if (m.internal) {
          return (
            <li key={m.id} className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-950 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-100">
              <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-300">
                <StickyNote className="size-3" /> Internal note · {m.authorName} · {dateTime(m.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          )
        }
        const staff = m.from === 'staff'
        return (
          <li key={m.id} className={cn('max-w-[80%] rounded-xl px-3 py-2 text-sm', staff ? 'justify-self-end bg-info-soft' : 'justify-self-start bg-muted')}>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {staff ? `${m.authorName} (shown as Autovogue Support)` : `${m.authorName || `The ${who}`}`} · {dateTime(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Composer({ ticket, who, onSent, onError }: { ticket: AdminTicketDetail; who: string; onSent: () => void; onError: (e: unknown) => void }) {
  const reply = useReplyToTicket()
  const [mode, setMode] = useState<'reply' | 'internal'>('reply')
  const [body, setBody] = useState('')
  const internal = mode === 'internal'
  const text = body.trim()
  const submit = () =>
    reply.mutateAsync({ id: ticket.id, body: text, internal }).then(() => { setBody(''); onSent() }, onError)

  return (
    <Panel
      title={internal ? 'Add an internal note' : `Reply to the ${who}`}
      actions={
        <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as typeof mode)} variant="outline" size="sm">
          <ToggleGroupItem value="reply"><Send /> Reply to {who}</ToggleGroupItem>
          <ToggleGroupItem value="internal"><StickyNote /> Internal note</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <p className={cn('mb-2 rounded-md px-3 py-2 text-xs', internal ? 'bg-yellow-50 text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-200' : 'bg-info-soft text-info')}>
        {internal
          ? `Only staff can see this. The ${who} is not told and the status does not change.`
          : `The ${who} sees this from "Autovogue Support", never your name. They get a notification, and the ticket moves to Awaiting reply${ticket.assignee ? '' : ' and is assigned to you'}.`}
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={MAX_BODY}
        placeholder={internal ? 'Note for other staff' : `Write to the ${who}`}
        aria-label={internal ? 'Internal note' : `Reply to the ${who}`}
        className={cn(internal && 'border-yellow-300 bg-yellow-50/60 dark:border-yellow-400/30 dark:bg-yellow-400/5')}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular">{body.length} / {MAX_BODY}</span>
        <Button disabled={!text || reply.isPending} onClick={submit}>
          {internal ? <><StickyNote /> Add note</> : <><Send /> Send as Autovogue Support</>}
        </Button>
      </div>
    </Panel>
  )
}

function AssignActions({ ticket, meId, onError }: { ticket: AdminTicketDetail; meId?: string; onError: (e: unknown) => void }) {
  const assign = useAssignTicket()
  const staff = useSupportAssignees()
  const mine = !!meId && ticket.assignee?.id === meId
  return (
    <>
      {!mine && (
        <Button variant="outline" disabled={assign.isPending} onClick={() => assign.mutateAsync({ id: ticket.id }).catch(onError)}>
          <UserCheck /> Take over
        </Button>
      )}
      <NativeSelect
        aria-label="Assign to"
        value=""
        disabled={assign.isPending || !staff.data}
        onChange={(e) => e.target.value && assign.mutateAsync({ id: ticket.id, staffId: e.target.value }).catch(onError)}
        className="w-48"
      >
        <NativeSelectOption value="">Assign to...</NativeSelectOption>
        {(staff.data ?? []).filter((s) => s.id !== ticket.assignee?.id).map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>{s.name}{s.id === meId ? ' (me)' : ''}</NativeSelectOption>
        ))}
      </NativeSelect>
    </>
  )
}

const SETTABLE: TicketStatus[] = ['open', 'in_progress', 'awaiting_reply']

function StatusActions({ ticket, onError }: { ticket: AdminTicketDetail; onError: (e: unknown) => void }) {
  const setStatus = useSetTicketStatus()
  const [confirmClose, setConfirmClose] = useState(false)
  const who = requesterLabel(ticket.requesterType).toLowerCase()
  return (
    <>
      <NativeSelect
        aria-label="Ticket status"
        value={ticket.status}
        disabled={setStatus.isPending}
        onChange={(e) => setStatus.mutateAsync({ id: ticket.id, status: e.target.value as TicketStatus }).catch(onError)}
        className="w-40"
      >
        {SETTABLE.map((s) => <NativeSelectOption key={s} value={s}>{TICKET_STATUS_LABEL[s]}</NativeSelectOption>)}
      </NativeSelect>
      <Button variant="destructive" onClick={() => setConfirmClose(true)}><XCircle /> Close ticket</Button>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Close ticket {ticket.reference}?</DialogTitle>
            <DialogDescription>
              Closing is final. Nobody can reply to this ticket again, and it can't be reopened. The {who} is notified that Autovogue Support closed it, and has to open a new ticket if they still need help.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(false)}>Keep it open</Button>
            <Button
              variant="destructive"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutateAsync({ id: ticket.id, status: 'closed' }).then(() => setConfirmClose(false), (e) => { setConfirmClose(false); onError(e) })}
            >
              Close ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
