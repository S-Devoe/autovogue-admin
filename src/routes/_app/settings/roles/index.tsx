import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { Button } from '@/components/ui/button'
import { useRoles } from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'

export const Route = createFileRoute('/_app/settings/roles/')({ component: Roles })

function Roles() {
  const { can } = useCan()
  const q = useRoles()
  const nav = useNavigate()
  return (
    <>
      <PageHeader eyebrow="Settings" title="Roles and permissions" description="A role is a named set of permissions. Default roles are locked; clone one to customise it. Roles with sensitive permissions need a second super admin."
        actions={can('roles.manage') && <Button onClick={() => nav({ to: '/settings/roles/$id', params: { id: 'new' } })}><Plus /> New role</Button>} />
      {q.isLoading ? <Rows /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data?.map((r, i) => (
            <Link key={r.id} to="/settings/roles/$id" params={{ id: r.id }} className="rise group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold">{r.name}</p>
                <div className="flex gap-1">
                  {r.isSystem && <Pill tone="brand" dot={false}>Default</Pill>}
                  {r.viewOnly && <Pill dot={false}>View only</Pill>}
                  {r.disabled && <Pill tone="danger">Disabled</Pill>}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.purpose}</p>
              <p className="mt-4 text-xs"><b className="tabular">{r.isSuper ? 'All' : r.permissionKeys.length}</b> permissions · <b className="tabular">{r.staffCount}</b> staff</p>
            </Link>
          ))}
        </div>
      )}
      <Panel title="How it works" className="mt-5">
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          <li>· A staff member can hold several roles; they can do everything any of their roles allows.</li>
          <li>· Sensitive permissions (money, identity files, roles) also ask for a fresh authenticator code.</li>
          <li>· Nobody can approve their own proposal, whatever their roles.</li>
          <li>· The API checks every request. Hiding a button here is never the only protection.</li>
        </ul>
      </Panel>
    </>
  )
}
