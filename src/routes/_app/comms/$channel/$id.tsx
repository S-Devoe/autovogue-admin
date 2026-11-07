import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Pause, Play, XCircle } from 'lucide-react'
import { KV, PageHeader, Panel, Rows } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { CHANNEL, EmailPreview, KindPill, PushPreview, isChannel } from '@/components/comms/campaign-bits'
import { Button } from '@/components/ui/button'
import { DEEP_LINKS, audienceLabel, useCampaign, useCampaignAction, type Channel } from '@/services/comms/campaigns.api'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/comms/$channel/$id')({ component: CampaignDetail })

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-semibold tabular">{value.toLocaleString('en-NG')}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function CampaignDetail() {
  const { channel: raw, id } = Route.useParams()
  const channel: Channel = isChannel(raw) ? raw : 'email'
  const q = useCampaign(id)
  const act = useCampaignAction()
  const { can } = useCan()
  const [cancelling, setCancelling] = useState(false)
  const c = q.data
  if (q.isLoading || !c) return <Rows />
  const meta = CHANNEL[channel]
  const pct = c.targeted ? Math.round((c.sent / c.targeted) * 100) : 0
  const ex = c.excluded ?? {}
  const live = ['scheduled', 'sending', 'paused'].includes(c.status)

  return (
    <>
      <PageHeader eyebrow="Comms" title={c.name} crumbs={[{ label: meta.label, to: `/comms/${channel}` }]}
        description={<span className="flex flex-wrap items-center gap-2"><StatusPill value={c.status} /><KindPill kind={c.kind} /> {audienceLabel(c.audience)}</span>}
        actions={can('broadcasts.send') && live && (
          <>
            {(c.status === 'sending' || c.status === 'scheduled') && (
              <Button variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id, action: 'pause' })}><Pause /> Pause</Button>
            )}
            {c.status === 'paused' && <Button disabled={act.isPending} onClick={() => act.mutate({ id, action: 'resume' })}><Play /> Resume</Button>}
            <Button variant="destructive" onClick={() => setCancelling(true)}><XCircle /> Cancel campaign</Button>
          </>
        )} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Panel title="Delivery">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="In audience" value={c.targeted} />
              <Stat label={channel === 'email' ? 'Handed to email' : 'Sent'} value={c.sent} hint={c.targeted ? `${pct}%` : undefined} />
              {channel === 'push' ? <Stat label="Delivered to phones" value={c.delivered ?? 0} hint="FCM accepted it" /> : <Stat label="Failed" value={c.failed} />}
              <Stat label="Left out" value={(ex.suspended ?? 0) + (ex.optedOut ?? 0) + (ex.noEmail ?? 0)}
                hint={[ex.optedOut ? `${ex.optedOut} opted out` : '', ex.suspended ? `${ex.suspended} suspended` : '', ex.noEmail ? `${ex.noEmail} no email` : ''].filter(Boolean).join(', ') || undefined} />
            </div>
            {c.status === 'sending' && (
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {channel === 'email'
                ? 'Emails go out through our mail queue. Opens and bounces are not tracked yet.'
                : 'Push goes to every signed-in phone (respecting each person\'s notification settings) and to the in-app feed. Delivered counts people whose phone accepted it.'}
            </p>
          </Panel>
          <Panel title="Details">
            <KV cols={2} items={[
              ['Created', dateTime(c.createdAt)],
              ['Scheduled for', dateTime(c.scheduledAt)],
              ['Started', dateTime(c.startedAt)],
              [c.status === 'cancelled' ? 'Cancelled' : 'Finished', dateTime(c.cancelledAt ?? c.sentAt)],
              ...(channel === 'push' ? [['Opens', DEEP_LINKS.find((d) => d.value === c.deepLink)?.label ?? 'Notifications'] as [string, string]] : []),
              ...(c.actionUrl ? [['Button', `${c.actionLabel} (${c.actionUrl})`] as [string, string]] : []),
            ]} />
          </Panel>
        </div>
        <aside>
          {channel === 'push'
            ? <PushPreview title={c.title} body={c.body} />
            : <EmailPreview subject={c.title} previewText={c.previewText} body={c.body} actionLabel={c.actionLabel} />}
        </aside>
      </div>

      <ReasonDialog open={cancelling} onOpenChange={setCancelling} destructive title={`Cancel: ${c.name}`} confirmLabel="Cancel campaign" pending={act.isPending}
        consequence={`Nobody else gets it. The ${c.sent.toLocaleString('en-NG')} already sent can't be recalled.`}
        onConfirm={(reason) => act.mutateAsync({ id, action: 'cancel', reason }).then(() => setCancelling(false))} />
    </>
  )
}
