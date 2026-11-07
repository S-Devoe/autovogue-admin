import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Copy, Lock } from 'lucide-react'
import { Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, FieldLabel } from '@/components/ui/field'
import { useCloneRole, useDisableRole, usePermissionCatalog, useRole, useSaveRole, type Permission } from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/settings/roles/$id')({ component: RoleBuilder })

const RISKY: [string, string][] = [
  ['refunds.create', 'money.approve'], ['disbursements.create', 'money.approve'], ['staff.invite', 'roles.manage'],
  ['config.propose', 'config.approve'], ['payouts.hold', 'payouts.release'],
]
const isView = (k: string) => /\.view(_own|_all)?$/.test(k)

function RoleBuilder() {
  const { id } = Route.useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const { can } = useCan()
  const role = useRole(isNew ? undefined : id)
  const catalog = usePermissionCatalog()
  const save = useSaveRole()
  const clone = useCloneRole()
  const disable = useDisableRole()
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [viewOnly, setViewOnly] = useState(false)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<'save' | 'clone' | 'disable' | null>(null)
  const [cloneName, setCloneName] = useState('')

  useEffect(() => {
    if (role.data) {
      setName(role.data.name)
      setPurpose(role.data.purpose)
      setViewOnly(role.data.viewOnly)
      setKeys(new Set(role.data.permissionKeys))
    }
  }, [role.data])

  const locked = !isNew && (role.data?.isSystem ?? true)
  const editable = can('roles.manage') && !locked
  const areas = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of catalog.data ?? []) m.set(p.area, [...(m.get(p.area) ?? []), p])
    return [...m.entries()]
  }, [catalog.data])
  const sensitive = (catalog.data ?? []).filter((p) => p.sensitive && keys.has(p.key))
  const warnings = RISKY.filter(([a, b]) => keys.has(a) && keys.has(b))
  const toggle = (k: string, on: boolean) => setKeys((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n })

  if ((!isNew && role.isLoading) || catalog.isLoading) return <Rows n={10} />

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Roles', to: '/settings/roles' }]}
        title={isNew ? 'New role' : <span className="flex items-center gap-3">{role.data?.name} {locked && <Pill tone="brand"><Lock className="size-3" /> Default role</Pill>} {role.data?.disabled && <Pill tone="danger">Disabled</Pill>}</span>}
        description={locked ? 'Default roles are locked so their meaning never drifts. Clone it to make a custom version.' : 'Pick permissions by area. Sensitive ones are marked.'}
        actions={
          <>
            {!isNew && can('roles.manage') && <Button variant="outline" onClick={() => { setCloneName(`${role.data?.name} (copy)`); setDialog('clone') }}><Copy /> Clone</Button>}
            {!isNew && editable && <Button variant="outline" onClick={() => setDialog('disable')}>{role.data?.disabled ? 'Enable' : 'Disable'}</Button>}
            {editable && <Button disabled={!name.trim() || purpose.trim().length < 3 || keys.size === 0 || role.data?.pendingChange} onClick={() => setDialog('save')}>{isNew ? 'Create role' : 'Save changes'}</Button>}
          </>
        }
      />
      {role.data?.pendingChange && <div className="mb-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">A change to this role is waiting for approval.</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-5">
          <Panel title="About">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel>Name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} /></Field>
              <Field><FieldLabel>Purpose (one line)</FieldLabel><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} disabled={!editable} /></Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch aria-label="View-only role" checked={viewOnly} disabled={!editable} onCheckedChange={(v) => { setViewOnly(v); if (v) setKeys((s) => new Set([...s].filter(isView))) }} />
              View only (auditors and observers): limits the role to view permissions
            </label>
          </Panel>
          {areas.map(([area, perms]) => (
            <Panel key={area} title={titleCase(area)} flush>
              <ul className="divide-y">
                {perms.map((p) => {
                  const disabled = !editable || (viewOnly && !isView(p.key)) || role.data?.isSuper
                  return (
                    <li key={p.key}>
                      <label className={`flex items-center gap-3 px-4 py-2.5 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/40'}`}>
                        <Checkbox checked={role.data?.isSuper || keys.has(p.key)} disabled={disabled} onCheckedChange={(c) => toggle(p.key, !!c)} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm">{p.description}</span>
                          <Mono className="text-muted-foreground">{p.key}</Mono>
                        </span>
                        {p.sensitive && <Pill tone="warning" dot={false}>Sensitive</Pill>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          ))}
        </div>
        <div className="grid content-start gap-5 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Summary">
            <p className="text-sm"><b className="tabular">{role.data?.isSuper ? 'Every' : keys.size}</b> permissions{sensitive.length > 0 && <>, <b className="text-warning">{sensitive.length} sensitive</b></>}.</p>
            {sensitive.length > 0 && editable && <p className="mt-2 text-xs text-muted-foreground">Because it has sensitive permissions, saving sends it to a second super admin for approval.</p>}
            {warnings.length > 0 && (
              <ul className="mt-3 grid gap-2">
                {warnings.map(([a, b]) => (
                  <li key={a + b} className="flex gap-2 rounded-lg bg-warning-soft p-2 text-xs text-warning">
                    <AlertTriangle className="size-4 shrink-0" /> <span><Mono>{a}</Mono> with <Mono>{b}</Mono> lets one person start and approve the same kind of action. Self-approval is still blocked when it runs.</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {!isNew && !!role.data?.history?.length && (
            <Panel title="History">
              <ol className="grid gap-3 text-xs">
                {role.data.history.map((h, i) => {
                  const before = new Set(h.beforeKeys ?? [])
                  const after = new Set(h.afterKeys ?? [])
                  const added = [...after].filter((k) => !before.has(k))
                  const removed = [...before].filter((k) => !after.has(k))
                  return (
                    <li key={i} className="border-l-2 pl-3">
                      <p className="font-semibold">{titleCase(h.change)} · {h.changedByName ?? 'system'}</p>
                      <p className="text-muted-foreground">{dateTime(h.createdAt)}{h.reason && ` · "${h.reason}"`}</p>
                      {added.length > 0 && <p className="text-success">+ {added.join(', ')}</p>}
                      {removed.length > 0 && <p className="text-danger">- {removed.join(', ')}</p>}
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )}
        </div>
      </div>
      <ReasonDialog open={dialog === 'save'} onOpenChange={(o) => !o && setDialog(null)} title={isNew ? 'Create role' : 'Save role'} pending={save.isPending}
        confirmLabel={sensitive.length ? 'Send for approval' : 'Save'}
        consequence={sensitive.length ? 'This role has sensitive permissions, so a second super admin must approve it before it exists or changes.' : 'Takes effect within a minute for everyone who holds it.'}
        onConfirm={(reason) => save.mutateAsync({ id: isNew ? undefined : id, name: name.trim(), purpose: purpose.trim(), viewOnly, permissionKeys: [...keys], reason })
          .then((r) => { setDialog(null); const created = (r.data as { role?: { id: string } })?.role?.id; if (isNew && created) nav({ to: '/settings/roles/$id', params: { id: created } }); else if (isNew) nav({ to: '/settings/roles' }) })} />
      <ReasonDialog open={dialog === 'clone'} onOpenChange={(o) => !o && setDialog(null)} title="Clone role" confirmLabel="Clone" pending={clone.isPending} canConfirm={cloneName.trim().length >= 2}
        consequence="Creates a custom role with the same permissions that you can then edit."
        onConfirm={(reason) => clone.mutateAsync({ id, name: cloneName.trim(), reason }).then((r) => { setDialog(null); const nid = (r.data as { role?: { id: string } })?.role?.id; nav(nid ? { to: '/settings/roles/$id', params: { id: nid } } : { to: '/settings/roles' }) })}>
        <Field><FieldLabel>New role name</FieldLabel><Input value={cloneName} onChange={(e) => setCloneName(e.target.value)} /></Field>
      </ReasonDialog>
      <ReasonDialog open={dialog === 'disable'} onOpenChange={(o) => !o && setDialog(null)} destructive={!role.data?.disabled} title={role.data?.disabled ? 'Enable role' : 'Disable role'} confirmLabel={role.data?.disabled ? 'Enable' : 'Disable'} pending={disable.isPending}
        consequence={role.data?.disabled ? 'Staff who hold it get its permissions back.' : `${role.data?.staffCount ?? 0} staff hold this role. Anyone whose only role it is loses access.`}
        onConfirm={(reason) => disable.mutateAsync({ id, disabled: !role.data?.disabled, reason }).then(() => setDialog(null))} />
    </>
  )
}
