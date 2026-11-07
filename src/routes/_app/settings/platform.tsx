import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Hourglass, PauseOctagon, Pencil } from 'lucide-react'
import { PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfig, useConfigHistory, useProposeConfig, useToggleSwitch, type ConfigItem, type SwitchItem } from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'
import { bps, dateTime, naira } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/platform')({ component: Platform })

const show = (c: Pick<ConfigItem, 'kind'>, v?: string) => {
  if (v == null || v === '') return '-'
  const n = Number(v)
  return c.kind === 'bps' ? `${bps(n)} (${n} bps)` : c.kind === 'kobo' ? naira(n) : v
}

function Platform() {
  const { can } = useCan()
  const q = useConfig()
  const history = useConfigHistory()
  const { rows: historyRows, pager: historyPager } = usePager(history)
  const propose = useProposeConfig()
  const toggle = useToggleSwitch()
  const [edit, setEdit] = useState<ConfigItem | null>(null)
  const [value, setValue] = useState('')
  const [sw, setSw] = useState<SwitchItem | null>(null)
  if (q.isLoading || !q.data) return <Rows n={8} />
  const asInput = (c: ConfigItem, v: string) => (c.kind === 'kobo' ? String(Number(v) / 100) : v)
  const fromInput = (c: ConfigItem, v: string) => (c.kind === 'kobo' ? String(Math.round(Number(v) * 100)) : v)
  const paused = q.data.switches.filter((s) => s.paused)

  return (
    <>
      <PageHeader eyebrow="Settings" title="Platform settings" description="Change how the marketplace runs without a deploy. Money settings need a second approver. The API reads new values within a minute." />
      {paused.length > 0 && (
        <div className="rise mb-5 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <PauseOctagon className="size-4" /> Paused right now: {paused.map((s) => s.label).join(', ')}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Settings" flush>
          <ul className="divide-y">
            {q.data.settings.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">{c.label} {c.money && <Pill tone="info" dot={false}>Two-person</Pill>} {c.pendingChange && <Pill tone="warning"><Hourglass className="size-3" /> Awaiting approval</Pill>}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold tabular">{show(c, c.value)}</p>
                  <p className="text-[11px] text-muted-foreground">{c.source === 'general' ? 'Uses the general rate' : c.source === 'default' ? 'Default (not set)' : `Updated ${dateTime(c.updatedAt)}`}</p>
                </div>
                {can('config.propose') && <Button size="sm" variant="outline" disabled={c.pendingChange} onClick={() => { setEdit(c); setValue(asInput(c, c.value)) }}><Pencil /> Change</Button>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Kill switches" description="Pause risky areas during an outage. The apps show a banner while paused.">
          <ul className="grid gap-3">
            {q.data.switches.map((s) => (
              <li key={s.key} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className={s.paused ? 'text-xs font-semibold text-danger' : 'text-xs text-muted-foreground'}>{s.paused ? 'Paused' : 'Running'}</p>
                </div>
                <Switch aria-label={`${s.paused ? 'Resume' : 'Pause'} ${s.label.toLowerCase()}`} checked={s.paused} disabled={!can('switches.toggle')} onCheckedChange={() => setSw(s)} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="History" className="mt-5" flush>
        {!historyRows.length ? <p className="p-4 text-sm text-muted-foreground">No changes yet.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Setting</TableHead><TableHead>Change</TableHead><TableHead>By</TableHead><TableHead>Approved by</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {historyRows.map((h) => {
                const c = q.data!.settings.find((s) => s.key === h.key)
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{dateTime(h.createdAt)}</TableCell>
                    <TableCell className="text-sm">{c?.label ?? q.data!.switches.find((s) => s.key === h.key)?.label ?? h.key}</TableCell>
                    <TableCell className="text-sm tabular">{c ? `${show(c, h.oldValue)} → ${show(c, h.newValue)}` : `${h.oldValue ?? '-'} → ${h.newValue}`}</TableCell>
                    <TableCell className="text-sm">{h.changedByName ?? '-'}</TableCell>
                    <TableCell className="text-sm">{h.approvedByName ?? '-'}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{h.reason}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {historyPager}
      </Panel>
      {edit && (
        <ReasonDialog open onOpenChange={(o) => !o && setEdit(null)} title={`Change ${edit.label.toLowerCase()}`} confirmLabel={edit.money ? 'Send for approval' : 'Save'} pending={propose.isPending}
          canConfirm={value !== '' && !Number.isNaN(Number(value))}
          consequence={edit.money ? 'This is a money setting: a different staff member with approval rights must approve it before it applies.' : 'Applies within a minute.'}
          onConfirm={(reason) => propose.mutateAsync({ key: edit.key, value: fromInput(edit, value), reason }).then(() => setEdit(null))}>
          <Field>
            <FieldLabel>New value {edit.kind === 'kobo' ? '(₦)' : edit.kind === 'bps' ? '(basis points)' : ''}</FieldLabel>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
            <FieldDescription>Now {show(edit, edit.value)}. New: {show(edit, fromInput(edit, value))}.</FieldDescription>
          </Field>
        </ReasonDialog>
      )}
      {sw && (
        <ReasonDialog open onOpenChange={(o) => !o && setSw(null)} destructive={!sw.paused} title={`${sw.paused ? 'Resume' : 'Pause'} ${sw.label.toLowerCase()}`} confirmLabel={sw.paused ? 'Resume' : 'Pause now'} pending={toggle.isPending}
          consequence={sw.paused ? 'Normal service resumes.' : 'Takes effect within a minute across the apps. Use during a Paystack or Prembly outage.'}
          onConfirm={(reason) => toggle.mutateAsync({ key: sw.key, paused: !sw.paused, reason }).then(() => setSw(null))} />
      )}
    </>
  )
}
