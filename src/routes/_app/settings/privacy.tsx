import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlarmClock, FilePlus2, ShieldAlert } from 'lucide-react'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, useBreaches, useCreateBreach, useCreateDsr, useDsr, useUpdateBreach, useUpdateDsr } from '@/services/settings/settings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { Download } from 'lucide-react'
import { useCan } from '@/hooks/use-can'
import { dateTime, timeLeft, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/privacy')({ component: Privacy })

function Due({ at }: { at: string }) {
  const left = (new Date(at).getTime() - Date.now()) / 1000
  return <Pill tone={left < 0 ? 'danger' : left < 5 * 86400 ? 'warning' : 'neutral'}><AlarmClock className="size-3" /> {timeLeft(left)}</Pill>
}

function Privacy() {
  const { can } = useCan()
  const dsr = useDsr(can('dsr.view', 'dsr.log'))
  const { rows: dsrRows, pager: dsrPager } = usePager(dsr)
  const breaches = useBreaches(can('breaches.manage'))
  const { rows: breachesRows, pager: breachesPager } = usePager(breaches)
  const createDsr = useCreateDsr()
  const updateDsr = useUpdateDsr()
  const createBreach = useCreateBreach()
  const updateBreach = useUpdateBreach()
  const [form, setForm] = useState<'dsr' | 'breach' | null>(null)
  const [d, setD] = useState({ subjectType: 'user', subjectId: '', requesterEmail: '', kind: 'copy', notes: '' })
  const [b, setB] = useState({ summary: '', detectedAt: '', severity: 'medium', personalData: true })

  return (
    <>
      <PageHeader eyebrow="Settings" title="Privacy (NDPR)" description="Data subject requests (30 days to complete) and suspected data breaches (notify the NDPC within 72 hours)." />
      <div className="grid gap-5">
        <Panel title="Data subject requests" description="Copy, erasure or correction requests from users and vendors. Erasure keeps the financial records the law requires and anonymises the rest."
          actions={can('dsr.log') && <Button size="sm" onClick={() => setForm('dsr')}><FilePlus2 /> Log request</Button>} flush>
          {dsr.isLoading ? <Rows /> : !dsrRows.length ? <Empty title="No requests" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Requester</TableHead><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {dsrRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.requesterEmail}<p className="text-xs text-muted-foreground">{titleCase(r.subjectType)} {r.subjectId?.slice(-8)}</p></TableCell>
                    <TableCell>{titleCase(r.kind)}</TableCell>
                    <TableCell><StatusPill value={r.status === 'completed' ? 'verified' : r.status === 'rejected' ? 'rejected' : 'pending'} label={titleCase(r.status)} /></TableCell>
                    <TableCell>{r.status === 'completed' || r.status === 'rejected' ? dateTime(r.completedAt) : <Due at={r.dueAt} />}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{r.notes ?? '-'}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      {can('dsr.manage') && r.subjectId && (
                        <Button size="sm" variant="outline" onClick={() => downloadCsv(API_ENDPOINTS.dsrExport(r.id), {}, `autovogue-data-${r.subjectId}.json`)}><Download /> Export</Button>
                      )}
                      {can('dsr.manage') && r.status !== 'completed' && r.status !== 'rejected' && (
                        <NativeSelect aria-label="Change request status" value="" onChange={(e) => e.target.value && updateDsr.mutate({ id: r.id, status: e.target.value })} className="w-36">
                          <NativeSelectOption value="">Update...</NativeSelectOption>
                          <NativeSelectOption value="in_progress">In progress</NativeSelectOption>
                          <NativeSelectOption value="completed">Completed</NativeSelectOption>
                          <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
                        </NativeSelect>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {dsrPager}
        </Panel>
        {can('breaches.manage') && (
          <Panel title="Breach log" description="Record a suspected personal-data breach as soon as you know. The deadline counts from when it was detected."
            actions={<Button size="sm" variant="outline" className="text-danger" onClick={() => setForm('breach')}><ShieldAlert /> Record breach</Button>} flush>
            {breaches.isLoading ? <Rows /> : !breachesRows.length ? <Empty title="No breaches recorded" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Summary</TableHead><TableHead>Severity</TableHead><TableHead>Detected</TableHead><TableHead>NDPC deadline</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {breachesRows.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="max-w-80 text-sm">{x.summary}</TableCell>
                      <TableCell><Pill tone={x.severity === 'high' ? 'danger' : x.severity === 'medium' ? 'warning' : 'neutral'}>{titleCase(x.severity)}</Pill></TableCell>
                      <TableCell className="text-xs">{dateTime(x.detectedAt)}</TableCell>
                      <TableCell>{x.ndpcNotifiedAt ? <span className="text-xs">Notified {dateTime(x.ndpcNotifiedAt)}</span> : <Due at={x.notifyBy} />}</TableCell>
                      <TableCell>{titleCase(x.status)}</TableCell>
                      <TableCell className="text-right">
                        {x.status !== 'closed' && (
                          <NativeSelect aria-label="Change breach status" value="" onChange={(e) => e.target.value && updateBreach.mutate({ id: x.id, status: e.target.value })} className="w-36">
                            <NativeSelectOption value="">Update...</NativeSelectOption>
                            <NativeSelectOption value="contained">Contained</NativeSelectOption>
                            <NativeSelectOption value="notified">NDPC notified</NativeSelectOption>
                            <NativeSelectOption value="closed">Closed</NativeSelectOption>
                          </NativeSelect>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {breachesPager}
          </Panel>
        )}
        <Panel title="What we keep and for how long">
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            <li>· ID images: deleted 90 days after review.</li>
            <li>· ID numbers waiting on Prembly: encrypted, deleted when the check ends (24 hours at most).</li>
            <li>· ID numbers, dates of birth from IDs, RC numbers: never stored.</li>
            <li>· Verified legal names: for the life of the account (to match payout accounts).</li>
            <li>· Audit log: 7 years.</li>
          </ul>
        </Panel>
      </div>

      <Dialog open={form === 'dsr'} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-lg">Log a data subject request</DialogTitle><DialogDescription>Due 30 days from today.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field><FieldLabel>Requester email</FieldLabel><Input value={d.requesterEmail} onChange={(e) => setD({ ...d, requesterEmail: e.target.value })} /></Field>
            <Field><FieldLabel>Kind</FieldLabel><NativeSelect aria-label="Kind" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} className="w-full"><NativeSelectOption value="copy">Copy of data</NativeSelectOption><NativeSelectOption value="erasure">Erasure</NativeSelectOption><NativeSelectOption value="correction">Correction</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel>Account type</FieldLabel><NativeSelect aria-label="Account type" value={d.subjectType} onChange={(e) => setD({ ...d, subjectType: e.target.value })} className="w-full"><NativeSelectOption value="user">User</NativeSelectOption><NativeSelectOption value="tenant">Vendor</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel>Account ID (if known)</FieldLabel><Input value={d.subjectId} onChange={(e) => setD({ ...d, subjectId: e.target.value })} className="font-mono" /></Field>
          </div>
          <Field><FieldLabel>Notes</FieldLabel><Textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} rows={2} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button disabled={!d.requesterEmail || createDsr.isPending} onClick={() => createDsr.mutateAsync(d).then(() => setForm(null))}>Log request</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={form === 'breach'} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-lg">Record a suspected breach</DialogTitle><DialogDescription>Contain it, then notify the NDPC within 72 hours if personal data is at risk.</DialogDescription></DialogHeader>
          <Field><FieldLabel>What happened</FieldLabel><Textarea value={b.summary} onChange={(e) => setB({ ...b, summary: e.target.value })} rows={3} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field><FieldLabel>Detected at</FieldLabel><Input type="datetime-local" value={b.detectedAt} onChange={(e) => setB({ ...b, detectedAt: e.target.value })} /></Field>
            <Field><FieldLabel>Severity</FieldLabel><NativeSelect aria-label="Severity" value={b.severity} onChange={(e) => setB({ ...b, severity: e.target.value })} className="w-full"><NativeSelectOption value="low">Low</NativeSelectOption><NativeSelectOption value="medium">Medium</NativeSelectOption><NativeSelectOption value="high">High</NativeSelectOption></NativeSelect></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.personalData} onChange={(e) => setB({ ...b, personalData: e.target.checked })} className="size-4" /> Personal data may be involved</label>
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button className="bg-danger text-white hover:bg-danger/90" disabled={b.summary.trim().length < 10 || createBreach.isPending}
            onClick={() => createBreach.mutateAsync({ ...b, detectedAt: b.detectedAt ? new Date(b.detectedAt).toISOString() : new Date().toISOString() }).then(() => setForm(null))}>Record breach</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
