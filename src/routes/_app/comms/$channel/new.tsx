import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, MailCheck } from 'lucide-react'
import { PageHeader } from '@/components/common/page'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { AudienceSummary, CHANNEL, EmailPreview, PushPreview, isChannel } from '@/components/comms/campaign-bits'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DEEP_LINKS, EMAIL_LIMITS, PUSH_LIMITS, audienceLabel, contentProblems, isOwnLink,
  useAudiencePreview, useCampaignStates, useCreateCampaign, useTestCampaign,
  type Audience, type CampaignDraft, type CampaignKind, type Channel,
} from '@/services/comms/campaigns.api'
import { useCan } from '@/hooks/use-can'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/comms/$channel/new')({
  beforeLoad: ({ params }) => {
    if (!isChannel(params.channel)) throw redirect({ to: '/comms/$channel/new', params: { channel: 'email' } })
  },
  component: Builder,
})

const STEPS = ['Audience', 'Content', 'Schedule', 'Review'] as const

function Builder() {
  const channel = Route.useParams().channel as Channel
  const meta = CHANNEL[channel]
  const navigate = useNavigate()
  const { can, me } = useCan()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CampaignKind>('service')
  const [audience, setAudience] = useState<Audience>({ kind: 'everyone', verified: 'any', states: [], vendorTypes: [] })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [deepLink, setDeepLink] = useState('notifications')
  const [sendNow, setSendNow] = useState(true)
  const [sendAt, setSendAt] = useState('')
  const [confirming, setConfirming] = useState(false)

  const states = useCampaignStates()
  const preview = useAudiencePreview(channel, kind, audience)
  const test = useTestCampaign()
  const create = useCreateCampaign()

  const problems = contentProblems(title, body, previewText, actionUrl)
  const buttonProblem = (actionLabel === '') !== (actionUrl === '') ? 'Give the button both a label and a link, or neither.'
    : actionUrl && !isOwnLink(actionUrl) ? 'The button must link to an https://autovogue.app address.' : ''
  const contentReady = problems.length === 0 && title.trim() && body.trim() && (channel === 'push'
    ? title.length <= PUSH_LIMITS.title && body.length <= PUSH_LIMITS.body
    : title.length <= EMAIL_LIMITS.subject && body.length <= EMAIL_LIMITS.body && previewText.length <= EMAIL_LIMITS.preview && !buttonProblem)
  const scheduleReady = sendNow || (sendAt !== '' && Date.parse(sendAt) > Date.now() + 60_000)
  const audienceReady = name.trim().length >= 3 && (preview.data?.reachable ?? 0) > 0
  const ready = [audienceReady, !!contentReady, scheduleReady, true]

  const draft: CampaignDraft = useMemo(() => ({
    channel, name: name.trim(), kind, audience, title: title.trim(), body: body.trim(),
    ...(channel === 'email' ? { previewText: previewText.trim(), actionLabel: actionLabel.trim(), actionUrl: actionUrl.trim() } : { deepLink }),
    sendAt: sendNow || !sendAt ? undefined : new Date(sendAt).toISOString(),
  }), [channel, name, kind, audience, title, body, previewText, actionLabel, actionUrl, deepLink, sendNow, sendAt])

  if (!can('broadcasts.send')) {
    return (
      <>
        <PageHeader eyebrow="Comms" title={`New ${meta.one}`} crumbs={[{ label: meta.label, to: `/comms/${channel}` }]} />
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Your role can't send campaigns. Ask a super admin or someone in Operations.</p>
      </>
    )
  }

  const setA = (patch: Partial<Audience>) => setAudience((a) => ({ ...a, ...patch }))
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <>
      <PageHeader eyebrow="Comms" title={`New ${meta.one}`} crumbs={[{ label: meta.label, to: `/comms/${channel}` }]} />

      <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(i)} disabled={i > step && !ready.slice(0, i).every(Boolean)}
              aria-current={i === step ? 'step' : undefined}
              className={cn('w-full rounded-xl border px-4 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                i === step ? 'border-ring bg-accent' : 'bg-card hover:bg-muted')}>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step {i + 1}</span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rise rounded-xl border bg-card p-5">
          {step === 0 && (
            <div className="grid gap-5">
              <Field>
                <FieldLabel htmlFor="name">Campaign name (only staff see this)</FieldLabel>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="December holiday offer" />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <ToggleGroup value={[kind]} onValueChange={(v) => v[0] && setKind(v[0] as CampaignKind)} variant="outline">
                  <ToggleGroupItem value="service">Service</ToggleGroupItem>
                  <ToggleGroupItem value="marketing">Marketing</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {kind === 'service'
                    ? 'Information everyone in the audience must get (an outage, a policy change). Nobody can opt out.'
                    : `Promotions and news. People who ${channel === 'email' ? 'unsubscribed' : 'turned off "Offers & news"'} are left out.`}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Who gets it</FieldLabel>
                <ToggleGroup value={[audience.kind]} onValueChange={(v) => v[0] && setA({ kind: v[0] as Audience['kind'] })} variant="outline">
                  <ToggleGroupItem value="everyone">Everyone</ToggleGroupItem>
                  <ToggleGroupItem value="users">Users</ToggleGroupItem>
                  <ToggleGroupItem value="vendors">Vendors</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>Users are people on the AutoVogue app. Vendors are businesses on the vendor dashboard (the email goes to the owner).</FieldDescription>
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel>Verification</FieldLabel>
                  <NativeSelect aria-label="Verification" value={audience.verified} onChange={(e) => setA({ verified: e.target.value as Audience['verified'] })}>
                    <NativeSelectOption value="any">Anyone</NativeSelectOption>
                    <NativeSelectOption value="yes">Verified only</NativeSelectOption>
                    <NativeSelectOption value="no">Not yet verified</NativeSelectOption>
                  </NativeSelect>
                </Field>
                {audience.kind !== 'users' && (
                  <Field>
                    <FieldLabel>Vendor type</FieldLabel>
                    <div className="flex flex-wrap gap-4 pt-1.5 text-sm">
                      {([['fleet_partner', 'Fleet partners'], ['independent_host', 'Individual hosts']] as const).map(([v, l]) => (
                        <label key={v} className="flex items-center gap-2">
                          <Checkbox checked={audience.vendorTypes.includes(v)} onCheckedChange={() => setA({ vendorTypes: toggleIn(audience.vendorTypes, v) })} /> {l}
                        </label>
                      ))}
                    </div>
                    <FieldDescription>Leave both empty for all vendors.</FieldDescription>
                  </Field>
                )}
              </div>
              <Field>
                <FieldLabel>States ({audience.states.length ? `${audience.states.length} chosen` : 'all'})</FieldLabel>
                <div className="flex max-h-44 flex-wrap gap-x-5 gap-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
                  {states.data?.length ? states.data.map((s) => (
                    <label key={s} className="flex items-center gap-2">
                      <Checkbox checked={audience.states.includes(s.toLowerCase())} onCheckedChange={() => setA({ states: toggleIn(audience.states, s.toLowerCase()) })} /> {s}
                    </label>
                  )) : <span className="text-muted-foreground">No states with cars yet.</span>}
                </div>
                <FieldDescription>Users who booked a car in these states; vendors with a car there.</FieldDescription>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              {channel === 'email' ? (
                <>
                  <Field data-invalid={title.length > EMAIL_LIMITS.subject}>
                    <FieldLabel htmlFor="subject">Subject</FieldLabel>
                    <Input id="subject" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field data-invalid={previewText.length > EMAIL_LIMITS.preview}>
                    <FieldLabel htmlFor="preview">Preview text (optional)</FieldLabel>
                    <Input id="preview" value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
                    <FieldDescription>Shown next to the subject in most inboxes.</FieldDescription>
                  </Field>
                  <Field data-invalid={body.length > EMAIL_LIMITS.body}>
                    <FieldLabel htmlFor="body">Message</FieldLabel>
                    <Textarea id="body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                    <FieldDescription>{body.length} / {EMAIL_LIMITS.body}. Plain text; line breaks are kept. It opens with "Hello first name".</FieldDescription>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
                    <Field><FieldLabel htmlFor="al">Button label (optional)</FieldLabel><Input id="al" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="Book a car" /></Field>
                    <Field><FieldLabel htmlFor="au">Button link</FieldLabel><Input id="au" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://autovogue.app/..." /></Field>
                  </div>
                </>
              ) : (
                <>
                  <Field data-invalid={title.length > PUSH_LIMITS.title}>
                    <FieldLabel htmlFor="title">Title</FieldLabel>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <FieldDescription>{title.length} / {PUSH_LIMITS.title}</FieldDescription>
                  </Field>
                  <Field data-invalid={body.length > PUSH_LIMITS.body}>
                    <FieldLabel htmlFor="pbody">Message</FieldLabel>
                    <Textarea id="pbody" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
                    <FieldDescription>{body.length} / {PUSH_LIMITS.body}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Tapping it opens (AutoVogue app)</FieldLabel>
                    <NativeSelect aria-label="Tapping it opens" value={deepLink} onChange={(e) => setDeepLink(e.target.value)}>
                      {DEEP_LINKS.map((d) => <NativeSelectOption key={d.value} value={d.value}>{d.label}</NativeSelectOption>)}
                    </NativeSelect>
                    <FieldDescription>Vendors open their notifications on the dashboard.</FieldDescription>
                  </Field>
                </>
              )}
              <p className="text-xs text-muted-foreground">You can use {'{{first_name}}'}. Links must go to autovogue.app.</p>
              {(problems.length > 0 || buttonProblem) && (
                <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>{[...problems, buttonProblem].filter(Boolean).map((p) => <p key={p}>{p}</p>)}</div>
                </div>
              )}
              {channel === 'email' && (
                <div>
                  <Button variant="outline" disabled={!contentReady || test.isPending} onClick={() => test.mutate(draft)}>
                    <MailCheck /> Send me a test ({me?.email})
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <Field orientation="horizontal">
                <Switch id="now" checked={sendNow} onCheckedChange={setSendNow} />
                <FieldLabel htmlFor="now">Send right away</FieldLabel>
              </Field>
              {!sendNow && (
                <Field data-invalid={sendAt !== '' && !scheduleReady}>
                  <FieldLabel htmlFor="at">Send at (your time)</FieldLabel>
                  <Input id="at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="max-w-64" />
                  {sendAt !== '' && !scheduleReady && <FieldDescription>Pick a time at least a minute from now.</FieldDescription>}
                </Field>
              )}
              <p className="text-xs text-muted-foreground">
                It goes out in batches of 200. You can pause or cancel while it sends; what's already sent can't be recalled.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 text-sm">
              <p><b>{name}</b>, a {kind} {channel === 'email' ? 'email' : 'push'}.</p>
              <p>To <b>{audienceLabel(audience)}</b>: <b>{preview.data?.reachable.toLocaleString('en-NG') ?? '...'}</b> people, {sendNow ? 'right away' : `at ${new Date(sendAt).toLocaleString('en-NG')}`}.</p>
              {channel === 'push' && <p className="text-muted-foreground">It also lands in everyone's in-app notifications.</p>}
              {kind === 'marketing' && channel === 'email' && <p className="text-muted-foreground">Each email has a one-click unsubscribe link.</p>}
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">The send and your reason are saved in the audit log.</p>
            </div>
          )}

          <div className="mt-6 flex justify-between gap-2 border-t pt-4">
            {step === 0
              ? <Button variant="outline" render={<Link to="/comms/$channel" params={{ channel }} />} nativeButton={false}>Cancel</Button>
              : <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 3
              ? <Button disabled={!ready[step]} onClick={() => setStep(step + 1)}>Continue</Button>
              : <Button onClick={() => setConfirming(true)}>{sendNow ? 'Send' : 'Schedule'}</Button>}
          </div>
        </section>

        <aside className="grid gap-4 xl:sticky xl:top-20">
          <AudienceSummary preview={preview.data} channel={channel} loading={preview.isFetching} />
          {channel === 'push'
            ? <PushPreview title={title} body={body} />
            : <EmailPreview subject={title} previewText={previewText} body={body} actionLabel={actionLabel} />}
        </aside>
      </div>

      <ReasonDialog open={confirming} onOpenChange={setConfirming} pending={create.isPending}
        title={`${sendNow ? 'Send' : 'Schedule'}: ${name}`} confirmLabel={sendNow ? 'Send now' : 'Schedule'}
        consequence={`${preview.data?.reachable.toLocaleString('en-NG') ?? 0} people will get this ${channel === 'email' ? 'email' : 'push'}${sendNow ? ' right away' : ''}.`}
        onConfirm={(reason) => create.mutateAsync({ draft, reason }).then((r) =>
          navigate({ to: '/comms/$channel/$id', params: { channel, id: r.data.id } }))} />
    </>
  )
}
