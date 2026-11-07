import { Mail, Smartphone } from 'lucide-react'
import { Pill } from '@/components/common/status'
import type { AudiencePreview, Channel } from '@/services/comms/campaigns.api'

export const CHANNEL = {
  email: { label: 'Email campaigns', one: 'email campaign', icon: Mail },
  push: { label: 'Push campaigns', one: 'push campaign', icon: Smartphone },
} as const

export const isChannel = (v: string): v is Channel => v === 'email' || v === 'push'

export function KindPill({ kind }: { kind: string }) {
  return kind === 'marketing' ? <Pill tone="info" dot={false}>Marketing</Pill> : <Pill tone="brand" dot={false}>Service</Pill>
}

/** Who a campaign reaches and who is left out, and why. */
export function AudienceSummary({ preview, channel, loading }: { preview?: AudiencePreview; channel: Channel; loading?: boolean }) {
  const rows: [string, number][] = preview
    ? [
        ['Suspended or not activated', preview.excluded.suspended],
        ['Opted out of offers and news', preview.excluded.optedOut],
        ...(channel === 'email' ? ([['No email address', preview.excluded.noEmail]] as [string, number][]) : []),
      ]
    : []
  return (
    <section className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Audience</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular ${loading ? 'opacity-50' : ''}`}>{preview?.reachable.toLocaleString('en-NG') ?? '-'}</p>
      <p className="text-xs text-muted-foreground">people will get it</p>
      {preview && (
        <>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Users</dt><dd className="text-right tabular">{preview.users.toLocaleString('en-NG')}</dd>
            <dt className="text-muted-foreground">Vendors</dt><dd className="text-right tabular">{preview.vendors.toLocaleString('en-NG')}</dd>
            <dt className="col-span-2 mt-2 border-t pt-2 font-medium">Left out</dt>
            {rows.map(([label, n]) => (
              <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="text-right tabular">{n}</dd></div>
            ))}
          </dl>
          {channel === 'push' && preview.inAppOnly > 0 && (
            <p className="mt-3 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
              {preview.inAppOnly} of them have no phone signed in, so they'll see it in their in-app notifications only.
            </p>
          )}
          {preview.sample.length > 0 && <p className="mt-3 text-xs text-muted-foreground">For example: {preview.sample.join(', ')}</p>}
        </>
      )}
    </section>
  )
}

/** Lock-screen style preview of a push. */
export function PushPreview({ title, body }: { title: string; body: string }) {
  const fill = (s: string) => s.replace(/{{\s*first_name\s*}}/g, 'Ada')
  return (
    <section className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
      <div className="rounded-2xl bg-muted/80 p-3 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="grid size-5 place-items-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">AV</span>
          AutoVogue <span className="ml-auto">now</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold">{fill(title) || 'Title'}</p>
        <p className="text-sm text-muted-foreground">{fill(body) || 'Your message'}</p>
      </div>
    </section>
  )
}

/** Inbox-style preview of an email. */
export function EmailPreview({ subject, previewText, body, actionLabel }: { subject: string; previewText?: string; body: string; actionLabel?: string }) {
  const fill = (s: string) => s.replace(/{{\s*first_name\s*}}/g, 'Ada')
  return (
    <section className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
      <p className="text-sm font-semibold">{fill(subject) || 'Subject'}</p>
      {previewText && <p className="truncate text-xs text-muted-foreground">{fill(previewText)}</p>}
      <div className="mt-3 rounded-lg border bg-background p-3 text-sm">
        <p className="mb-2">Hello <b>Ada</b>,</p>
        <p className="whitespace-pre-wrap">{fill(body) || 'Your message'}</p>
        {actionLabel && <span className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{actionLabel}</span>}
      </div>
    </section>
  )
}
