import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, ChevronDown, ChevronUp, ShieldCheck, ShieldX, X } from 'lucide-react'
import { Empty, Filters, KV, Mono, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { FileViewerButton } from '@/components/common/file-viewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  REJECTION_REASONS, useDecideDocument, useDriverQueue, useIdentity, useRevokeDoc, useSecondReview, useVehicleDocQueue, useVerifyQueue, type DocKind, type Queue,
} from '@/services/verification/verification.api'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { useContent } from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'
import { age, dateOnly, dateTime, titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAttention } from '@/services/overview/overview.api'

const QUEUES = {
  users: { title: 'Users', attention: 'verify_renters', kind: 'user', desc: 'User KYC (NIN, BVN, licence, passport) needing a manual decision.' },
  hosts: { title: 'Individual hosts', attention: 'verify_hosts', kind: 'tenant', desc: 'Host KYC documents needing a manual decision.' },
  fleet: { title: 'Fleet partners', attention: 'verify_fleet', kind: 'tenant', desc: 'CAC certificates and director IDs. Approving the CAC sets the business name payouts must match.' },
  drivers: { title: 'Drivers', attention: 'verify_drivers', kind: 'driver', desc: "Drivers' licences uploaded by vendors." },
  vehicles: { title: 'Vehicle documents', attention: 'verify_vehicles', kind: 'vehicle', desc: 'Proof of ownership, insurance and roadworthiness. A car is bookable only with all three approved.' },
} as const

type QueueKey = keyof typeof QUEUES

export const Route = createFileRoute('/_app/verification/$queue')({
  validateSearch: (s: Record<string, unknown>): { status?: string; mode?: string; type?: string } => ({
    status: typeof s.status === 'string' ? s.status : undefined,
    mode: typeof s.mode === 'string' ? s.mode : undefined,
    type: typeof s.type === 'string' ? s.type : undefined,
  }),
  component: VerificationQueue,
})

/** A row normalised across the five queues. */
interface Item {
  id: string
  kind: DocKind
  who: string
  subtitle: string
  subjectId?: string
  docType: string
  fileRef: string | null
  status: string | null
  mode?: string | null
  nameMatched?: boolean | null
  dobMatched?: boolean | null
  provider?: string | null
  rejectionReason?: string | null
  purgedAt?: string | null
  createdAt: string
  updatedAt?: string
  expiresAt?: string
  revokedAt?: string | null
  isRenewal?: boolean
  currentFileRef?: string
  currentExpiresAt?: string
  vehicleStatus?: string
  secondReviewBy?: string | null
  secondReviewByName?: string
  secondReviewNote?: string | null
  fleet?: boolean
}

function VerificationQueue() {
  const { queue } = Route.useParams() as { queue: QueueKey }
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const cfg = QUEUES[queue] ?? QUEUES.users
  const people = queue === 'users' || queue === 'hosts' || queue === 'fleet'
  const pq = useVerifyQueue((queue === 'users' || !people ? 'renters' : queue) as Queue, { status: search.status, mode: search.mode, type: search.type })
  const { rows: pqRows, pager: pqPager } = usePager(pq)
  const dq = useDriverQueue()
  const vq = useVehicleDocQueue()
  const { rows: vqRows, pager: vqPager } = usePager(vq)

  const items: Item[] = useMemo(() => {
    if (people) {
      return pqRows.map((d) => ({
        id: d.id, kind: cfg.kind as DocKind,
        who: d.vendorName || [d.firstName, d.lastName].filter(Boolean).join(' ') || '-',
        subtitle: d.email ?? (d.tenantType ? titleCase(d.tenantType) : ''),
        subjectId: d.userId ?? d.tenantId,
        docType: d.documentType, fileRef: d.documentUrl, status: d.status, mode: d.verificationMode,
        nameMatched: d.nameMatched, dobMatched: d.dobMatched, provider: d.provider,
        rejectionReason: d.rejectionReason, purgedAt: d.documentPurgedAt, createdAt: d.createdAt, updatedAt: d.updatedAt,
        revokedAt: d.revokedAt, secondReviewBy: d.secondReviewBy, secondReviewByName: d.secondReviewByName, secondReviewNote: d.secondReviewNote,
        fleet: d.tenantType === 'fleet_partner',
      }))
    }
    if (queue === 'drivers') {
      return (dq.data ?? []).map((d) => ({ id: d.id, kind: 'driver', who: d.driverName ?? 'Driver', subtitle: `Vendor ${d.tenantId.slice(-6)}`, subjectId: d.tenantId, docType: d.documentType, fileRef: d.documentUrl, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt }))
    }
    return vqRows.map((d) => ({
      id: d.id, kind: 'vehicle', who: `${d.car} · ${d.licensePlate}`, subtitle: `${d.vendorName || 'Vendor'}${d.isRenewal ? ' · renewal' : ''}`,
      subjectId: d.vehicleId, docType: d.documentType, fileRef: d.fileRef || null, status: d.isRenewal ? 'renewal' : 'PENDING_REVIEW',
      createdAt: d.submittedAt, expiresAt: d.expiresAt, isRenewal: d.isRenewal, currentFileRef: d.currentFileRef, currentExpiresAt: d.currentExpiresAt,
      vehicleStatus: d.vehicleStatus,
    }))
  }, [people, pqRows, dq.data, vqRows, queue, cfg.kind])

  const loading = people ? pq.isLoading : queue === 'drivers' ? dq.isLoading : vq.isLoading
  const [selected, setSelected] = useState<string | null>(null)
  const current = items.find((i) => i.id === selected) ?? items[0]
  const idx = current ? items.indexOf(current) : -1

  useEffect(() => setSelected(null), [queue])

  const move = (d: number) => {
    const next = items[idx + d]
    if (next) setSelected(next.id)
  }

  return (
    <>
      <PageHeader eyebrow="Verification" title={cfg.title} description={cfg.desc} actions={<QueueTabs active={queue} />} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Panel flush>
          {people && (
            <Filters>
              <NativeSelect aria-label="Filter by status" value={search.status ?? 'pending'} onChange={(e) => navigate({ search: { ...search, status: e.target.value } })} className="w-40">
                {['pending', 'verified', 'rejected', 'failed', 'all'].map((s) => <NativeSelectOption key={s} value={s}>{titleCase(s)}</NativeSelectOption>)}
              </NativeSelect>
              <NativeSelect aria-label="Filter by review mode" value={search.mode ?? 'manual'} onChange={(e) => navigate({ search: { ...search, mode: e.target.value } })} className="w-44">
                <NativeSelectOption value="manual">Manual review</NativeSelectOption>
                <NativeSelectOption value="synchronous">Checked by Prembly</NativeSelectOption>
                <NativeSelectOption value="asynchronous">Waiting on Prembly</NativeSelectOption>
                <NativeSelectOption value="all">Any mode</NativeSelectOption>
              </NativeSelect>
              <span className="ml-auto text-xs text-muted-foreground">Oldest first · <span className="kbd">J</span> <span className="kbd">K</span> to move</span>
            </Filters>
          )}
          {loading ? <Rows /> : items.length === 0 ? (
            <Empty title="Queue is empty" hint="Nothing waiting for a decision here." icon={<ShieldCheck className="size-5" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Prembly</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id} onClick={() => setSelected(i.id)} className={cn('cursor-pointer', current?.id === i.id && 'bg-accent/70')}>
                    <TableCell>
                      <p className="font-medium">{i.who}</p>
                      <p className="text-xs text-muted-foreground">{i.subtitle}</p>
                    </TableCell>
                    <TableCell>{titleCase(i.docType)}</TableCell>
                    <TableCell><MatchFlags item={i} /></TableCell>
                    <TableCell><StatusPill value={i.status} /></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular">{age(i.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {people && pqPager}
          {queue === 'vehicles' && vqPager}
        </Panel>
        {current && <Review key={current.id} item={current} onPrev={() => move(-1)} onNext={() => move(1)} hasPrev={idx > 0} hasNext={idx < items.length - 1} />}
      </div>
    </>
  )
}

function QueueTabs({ active }: { active: QueueKey }) {
  const { data: attention } = useAttention()
  const count = (key: string) => attention?.items.find((i) => i.key === key)?.count ?? 0
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {(Object.keys(QUEUES) as QueueKey[]).map((q) => (
        <Link key={q} to="/verification/$queue" params={{ queue: q }} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground transition', active === q && 'bg-card text-foreground shadow-sm')}>
          {QUEUES[q].title}
          {count(QUEUES[q].attention) > 0 && (
            <span className="rounded-full bg-staging px-1.5 py-px text-[10px] font-bold text-[#0a0d14] tabular">{count(QUEUES[q].attention)}</span>
          )}
        </Link>
      ))}
    </div>
  )
}

function MatchFlags({ item }: { item: Item }) {
  if (item.nameMatched == null && item.dobMatched == null) return <span className="text-xs text-muted-foreground">{item.provider ? 'No match data' : 'Manual only'}</span>
  return (
    <span className="flex gap-1">
      <Pill tone={item.nameMatched ? 'success' : 'danger'} dot={false}>{item.nameMatched ? <Check className="size-3" /> : <X className="size-3" />} Name</Pill>
      {item.dobMatched != null && <Pill tone={item.dobMatched ? 'success' : 'danger'} dot={false}>{item.dobMatched ? <Check className="size-3" /> : <X className="size-3" />} DOB</Pill>}
    </span>
  )
}

function Review({ item, onPrev, onNext, hasPrev, hasNext }: { item: Item; onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean }) {
  const { can, me } = useCan()
  const revoke = useRevokeDoc()
  const second = useSecondReview()
  const content = useContent()
  const reasons = content.data?.rejectionReasons ?? REJECTION_REASONS
  const [extra, setExtra] = useState<'revoke' | 'second' | null>(null)
  const flaggedByMe = !!item.secondReviewBy && item.secondReviewBy === me?.id
  const decide = useDecideDocument()
  const identity = useIdentity(item.kind === 'user' ? 'user' : 'tenant', item.kind === 'user' || item.kind === 'tenant' ? item.subjectId : undefined)
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [legalName, setLegalName] = useState('')
  const pending = item.status === 'pending' || item.status === 'PENDING_REVIEW' || item.status === 'renewal'
  const canDecide = can('verifications.decide') && pending && !flaggedByMe
  const people = item.kind === 'user' || item.kind === 'tenant'

  const approve = () => decide.mutateAsync({ kind: item.kind, id: item.id, approve: true, legalName: legalName.trim() || undefined }).then(onNext)
  const reject = () => decide.mutateAsync({ kind: item.kind, id: item.id, approve: false, reasonCode, note: note.trim() }).then(onNext)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || e.metaKey || e.ctrlKey) return
      if (e.key === 'j') onNext()
      if (e.key === 'k') onPrev()
      if (e.key === 'a' && canDecide && !decide.isPending) approve()
      if (e.key === 'r' && canDecide) setMode('reject')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Panel
      className="xl:sticky xl:top-20 xl:self-start"
      title={item.who}
      description={`${titleCase(item.docType)} · submitted ${dateTime(item.createdAt)}`}
      actions={
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onPrev} disabled={!hasPrev} aria-label="Previous"><ChevronUp /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext} disabled={!hasNext} aria-label="Next"><ChevronDown /></Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {item.isRenewal && (
          <div className="rounded-lg border border-info/30 bg-info-soft p-3 text-xs text-info">
            <p className="font-semibold">Renewal of an approved document</p>
            <p className="mt-0.5">The car stays bookable on the current one{item.currentExpiresAt ? ` (valid until ${dateOnly(item.currentExpiresAt)})` : ''}. Approving swaps the new file in; rejecting keeps the current one and tells the vendor why.</p>
            {item.currentFileRef && can('files.view_identity') && (
              <div className="mt-2"><FileViewerButton fileRef={item.currentFileRef} label="Open current document" target={{ type: 'vehicle_document', id: item.id }} /></div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
          <div>
            <p className="text-xs font-semibold">{item.isRenewal ? 'New document' : 'Uploaded document'}</p>
            <p className="text-[11px] text-muted-foreground">Opens a 5-minute link. Every open is logged.</p>
          </div>
          {can('files.view_identity') ? (
            <FileViewerButton fileRef={item.fileRef} label="Open" target={{ type: `${item.kind}_document`, id: item.id }} purged={item.purgedAt} />
          ) : (
            <span className="text-xs text-muted-foreground">No access</span>
          )}
        </div>
        <KV
          items={[
            ['Status', <StatusPill value={item.status} />],
            // Prembly only checks people; vehicle and driver documents are reviewed by hand.
            ...(people ? ([
              ['Mode', item.mode ? titleCase(item.mode) : 'Manual'],
              ['Provider', item.provider ?? '-'],
              ['Prembly match', <MatchFlags item={item} />],
            ] as [string, React.ReactNode][]) : ([['Review', 'Manual, by staff']] as [string, React.ReactNode][])),
            ...(item.kind === 'vehicle' && item.vehicleStatus ? ([['Car status', titleCase(item.vehicleStatus)]] as [string, React.ReactNode][]) : []),
            ...(people ? ([['Verified legal name', identity.data?.legalName ?? <span className="text-muted-foreground">Not yet verified</span>]] as [string, React.ReactNode][]) : []),
            ...(item.expiresAt ? ([[item.isRenewal ? 'New document expires' : 'Expires', dateOnly(item.expiresAt)]] as [string, React.ReactNode][]) : []),
          ]}
        />
        {people && pending && item.provider === 'manual' && !item.fileRef && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
            <p className="font-semibold">Why is this here with nothing to look at?</p>
            <p className="mt-0.5">
              The vendor typed an ID number instead of uploading a picture. Prembly (the robot that checks ID numbers) only checks an
              individual host's own ID and a fleet partner's CAC number, so this one came straight to people. We never keep ID numbers
              (NDPR), so there is no file and no Prembly result. It stays Pending until someone decides.
            </p>
            <p className="mt-1">
              Approve only if you are sure who this person is (for example after a call with the vendor), and type their legal name.
              Otherwise reject it and ask the vendor to verify with their CAC number, or to upload a picture of the ID.
            </p>
          </div>
        )}
        {item.rejectionReason && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{item.revokedAt ? 'Revoked' : 'Rejected'}: {item.rejectionReason}</p>}
        {item.secondReviewBy && (
          <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">
            Second review asked by {item.secondReviewByName || 'a reviewer'}{item.secondReviewNote && `: ${item.secondReviewNote}`}.{flaggedByMe && ' Someone else must approve it.'}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {people && 'ID numbers and dates of birth are never stored or shown (NDPR).'}
          {people && !pending && item.updatedAt && !item.purgedAt && ` The image is deleted about ${dateTime(new Date(new Date(item.updatedAt).getTime() + 90 * 864e5).toISOString())}.`}
          {item.purgedAt && ` The image was deleted ${dateTime(item.purgedAt)}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {people && item.status === 'verified' && can('verifications.revoke') && (
            <Button size="sm" variant="outline" className="text-danger" onClick={() => setExtra('revoke')}>Revoke verification</Button>
          )}
          {item.fleet && pending && can('verifications.decide') && !item.secondReviewBy && (
            <Button size="sm" variant="outline" onClick={() => setExtra('second')}>Ask for a second review</Button>
          )}
        </div>
        <ReasonDialog open={extra === 'revoke'} onOpenChange={(o) => !o && setExtra(null)} destructive title="Revoke this verification" confirmLabel="Revoke" pending={revoke.isPending}
          consequence={item.kind === 'tenant' ? "The vendor is no longer verified: their cars leave the marketplace at once. Open bookings are listed for follow-up." : "The user is no longer verified and can't book until verified again."}
          onConfirm={(reason) => revoke.mutateAsync({ kind: item.kind === 'user' ? 'users' : 'tenants', id: item.id, reason }).then(() => setExtra(null))} />
        <ReasonDialog open={extra === 'second'} onOpenChange={(o) => !o && setExtra(null)} title="Ask for a second review" confirmLabel="Flag for second review" reasonLabel="What should the second reviewer check?" pending={second.isPending}
          consequence="Another reviewer must approve it. You can still reject it."
          onConfirm={(note) => second.mutateAsync({ id: item.id, note }).then(() => setExtra(null))} />

        {canDecide && mode === 'idle' && (
          <div className="grid gap-3 border-t pt-4">
            {people && (
              <Field>
                <FieldLabel htmlFor="legal">Legal name on the document</FieldLabel>
                <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={identity.data?.legalName ?? 'Exactly as printed (defaults to the profile name)'} />
                <FieldDescription>Payout and withdrawal accounts must match this name.</FieldDescription>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10 border-danger/30 text-danger hover:bg-danger-soft" onClick={() => setMode('reject')}>
                <ShieldX /> Reject <span className="kbd ml-1">R</span>
              </Button>
              <Button className="h-10 bg-success text-white hover:bg-success/90" onClick={approve} disabled={decide.isPending}>
                <ShieldCheck /> Approve <span className="kbd ml-1 border-white/30 bg-white/15 text-white">A</span>
              </Button>
            </div>
          </div>
        )}
        {canDecide && mode === 'reject' && (
          <div className="grid gap-3 border-t pt-4">
            <p className="text-sm font-semibold">Why are you rejecting it? The applicant sees this.</p>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <button key={r.code} onClick={() => setReasonCode(r.code)} className={cn('rounded-lg border px-3 py-2 text-left text-xs font-medium transition hover:border-ring/40', reasonCode === r.code && 'border-danger bg-danger-soft text-danger')}>
                  {r.label}
                </button>
              ))}
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the applicant" rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode('idle')}>Back</Button>
              <Button className="bg-danger text-white hover:bg-danger/90" disabled={!reasonCode || decide.isPending} onClick={reject}>Reject and notify</Button>
            </div>
          </div>
        )}
        {!pending && <p className="text-xs text-muted-foreground">Already decided.</p>}
        <p className="text-[11px] text-muted-foreground"><Mono>{item.id}</Mono></p>
      </div>
    </Panel>
  )
}
