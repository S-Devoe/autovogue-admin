import { Checkbox } from '@/components/ui/checkbox'
import type { Role } from '@/services/settings/settings.api'

export function RolePicker({ roles, value, onChange }: { roles: Role[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="grid gap-2">
      {roles.filter((r) => !r.disabled).map((r) => (
        <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-muted/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-secondary">
          <Checkbox checked={value.includes(r.id)} onCheckedChange={(c) => onChange(c ? [...value, r.id] : value.filter((v) => v !== r.id))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-semibold">{r.name} {r.isSystem && <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Default</span>}</span>
            <span className="block text-xs text-muted-foreground">{r.purpose}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
