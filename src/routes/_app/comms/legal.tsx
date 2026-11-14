import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, FileCheck2 } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows } from '@/components/common/page'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  LEGAL_AUDIENCES, LEGAL_SUMMARY_MAX, useLegal, usePublishLegal,
  type LegalAudience, type LegalDocumentKey, type LegalVersion,
} from '@/services/comms/legal.api'
import { useCan } from '@/hooks/use-can'
import { dateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/comms/legal')({ component: LegalPage })

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '-')

/**
 * Terms of Use, Privacy Policy and Cookie Policy. After the website pages
 * are updated, staff publish an update here: everyone in the audience then
 * has to accept it before they can keep using the app or vendor dashboard.
 */
function LegalPage() {
  const q = useLegal()
  const { can } = useCan()
  const [publishing, setPublishing] = useState(false)

  const data = q.data
  const versions = data?.versions ?? []
  const latest = (a: 'users' | 'vendors') => versions.find((v) => v.audience === a || v.audience === 'everyone')

  return (
    <>
      <PageHeader eyebrow="Comms" title="Terms and policies"
        description="Update the pages on the website first, then publish an update here. Everyone it is for must accept it before they can keep using the app or the vendor dashboard."
        actions={can('legal.publish') && <Button onClick={() => setPublishing(true)}><FileCheck2 /> Publish update</Button>} />

      {q.isLoading || !data ? <Rows /> : (
        <div className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Documents" description="Linked from both sign-ups and from the prompt.">
              <ul className="grid gap-2">
                {data.documents.map((d) => (
                  <li key={d.key}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                      <span className="font-medium">{d.title}</span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
            <Accepted title="Users" version={latest('users')} count={(v) => v.userAcceptances} total={data.totalUsers} noun="app users" />
            <Accepted title="Vendors" version={latest('vendors')} count={(v) => v.vendorAcceptances} total={data.totalVendorStaff} noun="dashboard staff" />
          </div>

          <Panel title="History" description="Newest first. Accepting a version also covers every older one." flush>
            {!versions.length ? <Empty title="Nothing published yet" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Published</TableHead><TableHead>For</TableHead><TableHead>Documents</TableHead>
                    <TableHead>What changed</TableHead>
                    <TableHead className="text-right">Users accepted</TableHead><TableHead className="text-right">Vendors accepted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {dateTime(v.publishedAt)}
                        <p className="text-muted-foreground">{v.publishedByName || 'AutoVogue'}</p>
                      </TableCell>
                      <TableCell className="text-xs">{LEGAL_AUDIENCES.find((a) => a.value === v.audience)?.label}</TableCell>
                      <TableCell className="text-xs">{v.documents.map((d) => d.title).join(', ')}</TableCell>
                      <TableCell><p className="max-w-96 whitespace-pre-line text-xs text-muted-foreground">{v.summary}</p></TableCell>
                      <TableCell className="text-right tabular">{v.audience === 'vendors' ? <span className="text-muted-foreground">-</span> : v.userAcceptances.toLocaleString('en-NG')}</TableCell>
                      <TableCell className="text-right tabular">{v.audience === 'users' ? <span className="text-muted-foreground">-</span> : v.vendorAcceptances.toLocaleString('en-NG')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      <PublishDialog open={publishing} onOpenChange={setPublishing} />
    </>
  )
}

function Accepted({ title, version, count, total, noun }: {
  title: string
  version?: LegalVersion
  count: (v: LegalVersion) => number
  total: number
  noun: string
}) {
  const n = version ? count(version) : 0
  return (
    <Panel title={`${title}: latest version`} description={version ? `Published ${dateTime(version.publishedAt)}` : 'Nothing published yet'}>
      <p className="font-display text-3xl font-semibold tabular">{pct(n, total)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {n.toLocaleString('en-NG')} of {total.toLocaleString('en-NG')} {noun} accepted. The rest see the prompt the next time they open it.
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: total ? `${Math.min(100, (n / total) * 100)}%` : 0 }} />
      </div>
    </Panel>
  )
}

const DOCS: { key: LegalDocumentKey; label: string }[] = [
  { key: 'terms', label: 'Terms of Use' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'cookies', label: 'Cookie Policy' },
]

function PublishDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const publish = usePublishLegal()
  const [audience, setAudience] = useState<LegalAudience>('everyone')
  const [docs, setDocs] = useState<LegalDocumentKey[]>([])
  const [summary, setSummary] = useState('')
  const reset = () => { setAudience('everyone'); setDocs([]); setSummary('') }
  const trimmed = summary.trim()
  const ok = docs.length > 0 && trimmed.length > 0 && trimmed.length <= LEGAL_SUMMARY_MAX
  const who = LEGAL_AUDIENCES.find((a) => a.value === audience)

  return (
    <ReasonDialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}
      title="Publish a terms or policy update" confirmLabel="Publish" pending={publish.isPending} canConfirm={ok}
      consequence={<>{who?.hint}: they must accept before they can carry on, the next time they open it. This can't be undone.</>}
      onConfirm={(reason) => publish.mutateAsync({ audience, documents: docs, summary: trimmed, reason }).then(() => { reset(); onOpenChange(false) })}>
      <Field>
        <FieldLabel>Who must accept</FieldLabel>
        <ToggleGroup value={[audience]} onValueChange={(v) => v[0] && setAudience(v[0] as LegalAudience)} variant="outline">
          {LEGAL_AUDIENCES.map((a) => <ToggleGroupItem key={a.value} value={a.value} className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">{a.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>What changed</FieldLabel>
        <div className="flex flex-wrap gap-4 pt-1 text-sm">
          {DOCS.map((d) => (
            <label key={d.key} className="flex items-center gap-2">
              <Checkbox checked={docs.includes(d.key)}
                onCheckedChange={(c) => setDocs((cur) => (c ? [...cur, d.key] : cur.filter((k) => k !== d.key)))} /> {d.label}
            </label>
          ))}
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="legal-summary">Message in the prompt</FieldLabel>
        <Textarea id="legal-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder="We've updated how long we keep trip photos. Please read the changes and accept to continue." />
        <FieldDescription>What people read above the links. {trimmed.length}/{LEGAL_SUMMARY_MAX}</FieldDescription>
      </Field>
    </ReasonDialog>
  )
}
