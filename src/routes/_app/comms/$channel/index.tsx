import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { StatusPill } from '@/components/common/status'
import { CHANNEL, KindPill, isChannel } from '@/components/comms/campaign-bits'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { audienceLabel, useCampaigns, type Channel } from '@/services/comms/campaigns.api'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/comms/$channel/')({
  beforeLoad: ({ params }) => {
    if (!isChannel(params.channel)) throw redirect({ to: '/comms/$channel', params: { channel: 'email' } })
  },
  component: CampaignList,
})

function CampaignList() {
  const channel = Route.useParams().channel as Channel
  const q = useCampaigns(channel)
  const { rows: qRows, pager: qPager } = usePager(q)
  const { can } = useCan()
  const meta = CHANNEL[channel]
  return (
    <>
      <PageHeader eyebrow="Comms" title={meta.label}
        description={channel === 'email'
          ? 'Emails to users, vendors or both. Marketing emails carry an unsubscribe link and skip people who unsubscribed.'
          : 'Push notifications to the AutoVogue app and the vendor dashboard. Everyone also gets it in their in-app notifications.'}
        actions={can('broadcasts.send') && (
          <Button render={<Link to="/comms/$channel/new" params={{ channel }} />} nativeButton={false}><Plus /> New {meta.one}</Button>
        )} />
      <Panel flush>
        {q.isLoading ? <Rows /> : !qRows.length ? <Empty title={`No ${meta.one}s yet`} /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Type</TableHead><TableHead>Audience</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Sent</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {qRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/comms/$channel/$id" params={{ channel, id: c.id }} className="font-medium hover:underline">{c.name}</Link>
                    <p className="max-w-80 truncate text-xs text-muted-foreground">{c.title}</p>
                  </TableCell>
                  <TableCell><KindPill kind={c.kind} /></TableCell>
                  <TableCell className="max-w-64 text-xs whitespace-normal">{audienceLabel(c.audience)}</TableCell>
                  <TableCell><StatusPill value={c.status} /></TableCell>
                  <TableCell className="text-right tabular">{c.sent.toLocaleString('en-NG')}{c.targeted > 0 && <span className="text-muted-foreground"> / {c.targeted.toLocaleString('en-NG')}</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateTime(c.sentAt ?? c.scheduledAt ?? c.createdAt)}</TableCell>
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
