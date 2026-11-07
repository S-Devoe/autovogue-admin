import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader, Panel, Rows } from '@/components/common/page'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useContent, useSaveContent, type Content } from '@/services/settings/settings.api'
import { useCan } from '@/hooks/use-can'

export const Route = createFileRoute('/_app/settings/content')({ component: ContentPage })

/**
 * Words the apps show that ops can change without a release: verification
 * rejection reasons, dispute category names and the cancellation policy
 * text. The refund percentages themselves live in Settings, Platform.
 */
function ContentPage() {
  const q = useContent()
  const save = useSaveContent()
  const { can } = useCan()
  const editable = can('config.propose')
  const [draft, setDraft] = useState<Content | null>(null)
  const [section, setSection] = useState<keyof Content | null>(null)
  useEffect(() => { if (q.data) setDraft(structuredClone(q.data)) }, [q.data])

  if (q.isLoading || !draft) return <Rows />
  const dirty = (k: keyof Content) => JSON.stringify(draft[k]) !== JSON.stringify(q.data?.[k])
  const SaveBtn = ({ k }: { k: keyof Content }) => editable ? <Button size="sm" disabled={!dirty(k)} onClick={() => setSection(k)}>Save</Button> : null

  return (
    <>
      <PageHeader eyebrow="Settings" title="Content" description="Text the apps and the vendor dashboard show. Changes go live within a minute and are logged." />
      <div className="grid gap-5">
        <Panel title="Verification rejection reasons" description="Staff pick one of these when rejecting. The label is what the applicant reads, followed by any note." actions={<SaveBtn k="rejectionReasons" />}>
          <div className="grid gap-2">
            {draft.rejectionReasons.map((r, i) => (
              <div key={i} className="grid grid-cols-[12rem_1fr_auto] items-center gap-2">
                <Input value={r.code} disabled={!editable} className="font-mono text-xs" aria-label="Code"
                  onChange={(e) => setDraft({ ...draft, rejectionReasons: draft.rejectionReasons.map((x, j) => j === i ? { ...x, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') } : x) })} />
                <Input value={r.label} disabled={!editable} aria-label="Label"
                  onChange={(e) => setDraft({ ...draft, rejectionReasons: draft.rejectionReasons.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                {editable && <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => setDraft({ ...draft, rejectionReasons: draft.rejectionReasons.filter((_, j) => j !== i) })}><Trash2 /></Button>}
              </div>
            ))}
            {editable && <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setDraft({ ...draft, rejectionReasons: [...draft.rejectionReasons, { code: '', label: '' }] })}><Plus /> Add reason</Button>}
          </div>
        </Panel>

        <Panel title="Dispute categories" description="The names users and vendors see when they open a dispute. The codes are fixed." actions={<SaveBtn k="disputeCategories" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(draft.disputeCategories).map(([code, label]) => (
              <Field key={code}>
                <FieldLabel className="font-mono text-[11px]">{code}</FieldLabel>
                <Input value={label} disabled={!editable} onChange={(e) => setDraft({ ...draft, disputeCategories: { ...draft.disputeCategories, [code]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Cancellation policy text" description="Shown in the AutoVogue app before cancelling and on the booking screen." actions={<SaveBtn k="cancellationPolicy" />}>
          <Field>
            <Textarea rows={6} value={draft.cancellationPolicy} disabled={!editable} onChange={(e) => setDraft({ ...draft, cancellationPolicy: e.target.value })} />
            <FieldDescription>Keep it in step with the refund tiers in Settings, Platform (cancellation keys). The app also shows the tiers worked out from those numbers.</FieldDescription>
          </Field>
        </Panel>
      </div>
      <ReasonDialog open={!!section} onOpenChange={(o) => !o && setSection(null)} title="Save content" confirmLabel="Save" pending={save.isPending}
        consequence="Everyone using the apps sees the new text within a minute."
        onConfirm={(reason) => void (section && save.mutateAsync({ [section]: draft[section], reason } as Partial<Content> & { reason: string }).then(() => setSection(null)))} />
    </>
  )
}
