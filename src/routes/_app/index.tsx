import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, CheckCircle2, CircleAlert, CircleDot, Clock3 } from 'lucide-react'
import { PageHeader, Panel } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAttention, useHealth, useMetrics, type AttentionItem } from '@/services/overview/overview.api'
import { useCan } from '@/hooks/use-can'
import { age, dateTime, naira } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/')({ component: Overview })

const stripe = { danger: 'bg-danger', warning: 'bg-warning', info: 'bg-info' }

function Overview() {
  const { me, can } = useCan()
  const attention = useAttention()
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today')
  const showNumbers = can('payments.view', 'bookings.view')
  const metrics = useMetrics(range, showNumbers)
  const health = useHealth()
  const items = attention.data?.items ?? []
  const urgent = items.filter((i) => i.severity === 'danger').reduce((a, i) => a + i.count, 0)
  const hour = Number(new Intl.DateTimeFormat('en-NG', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date()))
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date())}
        title={`${greet}, ${me?.fullName.split(' ')[0] ?? ''}`}
        description={items.length ? `${items.length} kinds of work need a decision${urgent ? `, ${urgent} of them urgent` : ''}. Oldest first.` : 'Nothing is waiting on you right now.'}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Work queue" description="Items you can act on, filtered by your role." flush>
          {attention.isLoading ? (
            <div className="grid gap-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-6 py-16 text-center">
              <CheckCircle2 className="size-9 text-success" />
              <p className="font-display text-lg font-semibold">All clear</p>
              <p className="text-sm text-muted-foreground">No verifications, disputes or money problems waiting.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((i, idx) => <QueueRow key={i.key} item={i} idx={idx} />)}
            </ul>
          )}
        </Panel>

        <div className="grid content-start gap-5">
          <Panel title="Background work" description="Queues, providers and jobs the admin depends on.">
            <ul className="grid gap-2.5 text-sm">
              <HealthRow ok={health.data?.rabbitmq} label="Message queue (RabbitMQ)" />
              <HealthRow ok={health.data?.redis} label="Cache and rate limits (Redis)" />
              <HealthRow ok={health.data?.storage} label="File storage (R2)" />
              <HealthRow ok={health.data?.push} label="Push notifications (FCM)" />
              <HealthRow ok={health.data?.staffTwoFactor} label="Staff 2FA key" />
              <li className="flex justify-between border-t pt-2.5 text-xs text-muted-foreground">
                <span>Dead-letter messages</span>
                <span className={cn('font-semibold tabular', Object.values(health.data?.deadLetters ?? {}).some((n) => n > 0) ? 'text-danger' : 'text-foreground')}>
                  {Object.values(health.data?.deadLetters ?? {}).reduce((a, n) => a + n, 0)}
                </span>
              </li>
              <li className="flex justify-between text-xs text-muted-foreground">
                <span>Alerts to Slack</span>
                <span className="font-semibold text-foreground">{health.data?.alertsToSlack ? 'On' : 'Not set up'}</span>
              </li>
              <li className="flex justify-between text-xs text-muted-foreground">
                <span>Payment re-checks pending</span>
                <span className="font-semibold text-foreground tabular">{health.data?.paymentChecksPending ?? '-'}</span>
              </li>
              <li className="flex justify-between text-xs text-muted-foreground">
                <span>Prembly checks waiting</span>
                <span className="font-semibold text-foreground tabular">{health.data?.kycChecksPending ?? '-'}</span>
              </li>
              <li className="flex justify-between text-xs text-muted-foreground">
                <span>Last reconciliation</span>
                <span className="font-semibold text-foreground">{health.data?.lastReconciliationAt ? `${age(health.data.lastReconciliationAt)} ago` : 'Never'}</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      {showNumbers && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">The numbers</h2>
            <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="7d">7 days</TabsTrigger>
                <TabsTrigger value="30d">30 days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Gross booking value" value={naira(metrics.data?.grossValueKobo)} loading={metrics.isLoading} big />
            <Stat label="AutoVogue commission" value={naira(metrics.data?.commissionKobo)} loading={metrics.isLoading} big />
            <Stat label="Payouts sent" value={naira(metrics.data?.payoutsKobo)} loading={metrics.isLoading} />
            <Stat label="Refunds" value={naira(metrics.data?.refundsKobo)} loading={metrics.isLoading} />
            <Stat label="Bookings created" value={metrics.data?.bookingsCreated} sub={metrics.data ? `${metrics.data.bookingsPaid} paid · ${metrics.data.bookingsCancelled} cancelled` : ''} loading={metrics.isLoading} />
            <Stat label="New users" value={metrics.data?.newRenters} loading={metrics.isLoading} />
            <Stat label="New vendors" value={metrics.data?.newVendors} loading={metrics.isLoading} />
            <Stat
              label="Verification approval rate"
              value={metrics.data && metrics.data.verificationsApproved + metrics.data.verificationsRejected > 0
                ? `${Math.round((metrics.data.verificationsApproved / (metrics.data.verificationsApproved + metrics.data.verificationsRejected)) * 100)}%`
                : '-'}
              loading={metrics.isLoading}
            />
          </div>
        </section>
      )}
      {attention.data?.lastReconciliationAt && <p className="mt-6 text-xs text-muted-foreground">Last successful reconciliation {dateTime(attention.data.lastReconciliationAt)} WAT</p>}
    </>
  )
}

function QueueRow({ item, idx }: { item: AttentionItem; idx: number }) {
  const [path, query] = item.link.split('?')
  const search = Object.fromEntries(new URLSearchParams(query ?? ''))
  return (
    <li className="rise" style={{ animationDelay: `${idx * 40}ms` }}>
      <Link to={path} search={search as never} className="group relative flex items-center gap-4 px-4 py-3.5 transition hover:bg-muted/60">
        <span className={cn('absolute inset-y-2 left-0 w-1 rounded-r', stripe[item.severity])} />
        <span className="w-14 text-right font-display text-2xl font-semibold tabular">{item.count}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{item.label}</span>
          {item.oldest && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3" /> Oldest waiting {age(item.oldest)}
            </span>
          )}
        </span>
        <Pill tone={item.severity === 'info' ? 'info' : item.severity} className="hidden sm:inline-flex">
          {item.severity === 'danger' ? 'Urgent' : item.severity === 'warning' ? 'Due' : 'FYI'}
        </Pill>
        <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  )
}

function HealthRow({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok === undefined ? <CircleDot className="size-4 text-muted-foreground" /> : ok ? <CheckCircle2 className="size-4 text-success" /> : <CircleAlert className="size-4 text-danger" />}
      <span className="flex-1 text-[13px]">{label}</span>
      <span className={cn('text-[11px] font-semibold', ok ? 'text-success' : ok === false ? 'text-danger' : 'text-muted-foreground')}>{ok === undefined ? '' : ok ? 'OK' : 'Off'}</span>
    </li>
  )
}

function Stat({ label, value, sub, loading, big }: { label: string; value?: React.ReactNode; sub?: string; loading?: boolean; big?: boolean }) {
  return (
    <div className="rise rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className={cn('mt-1.5 font-display font-semibold tabular', big ? 'text-2xl' : 'text-xl')}>{value ?? '-'}</p>}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
