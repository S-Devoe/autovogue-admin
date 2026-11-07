import { useState } from 'react'
import { History, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from './page'
import { useAudit } from '@/services/settings/settings.api'
import type { Note } from '@/services/bookings/bookings.api'
import { dateTime } from '@/lib/format'
import { useCan } from '@/hooks/use-can'

/** Staff-only notes on a record. Never shown to users or vendors. */
export function NotesPanel({ notes, canAdd, onAdd, pending }: { notes: Note[]; canAdd: boolean; onAdd: (body: string) => Promise<unknown>; pending?: boolean }) {
  const [body, setBody] = useState('')
  return (
    <Panel title={<span className="flex items-center gap-1.5"><StickyNote className="size-4" /> Staff notes</span>} description="Only staff can see these.">
      {canAdd && (
        <div className="mb-3 grid gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a note for the team" />
          <Button size="sm" className="justify-self-end" disabled={!body.trim() || pending} onClick={async () => { await onAdd(body.trim()); setBody('') }}>
            Add note
          </Button>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="grid gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border-l-2 border-primary/40 bg-muted/50 px-3 py-2">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{n.authorName} · {dateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** The audit trail for one record (staff without audit.view_all see their own entries). */
export function AuditTrail({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { can } = useCan()
  const q = useAudit({ targetType, targetId })
  if (!can('audit.view_own', 'audit.view_all')) return null
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <Panel title={<span className="flex items-center gap-1.5"><History className="size-4" /> Audit trail</span>}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No staff actions recorded on this yet.</p>
      ) : (
        <ol className="relative grid gap-3 border-l pl-4">
          {items.slice(0, 15).map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/70 ring-4 ring-card" />
              <p className="text-xs font-semibold">{a.action}</p>
              {a.reason && <p className="text-xs text-muted-foreground">"{a.reason}"</p>}
              <p className="text-[11px] text-muted-foreground">{a.staffEmail ?? 'system'} · {dateTime(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
