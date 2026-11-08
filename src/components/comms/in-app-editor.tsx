import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { InAppCard } from '@/components/comms/in-app-bits'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCan } from '@/hooks/use-can'
import { cn } from '@/lib/utils'
import {
  APP_LINKS, AUDIENCES, IMAGE_MAX_BYTES, IMAGE_TYPES, IN_APP_LIMITS, SWATCHES,
  draftProblems, uploadInAppImage, useCreateInApp, useSetInAppStatus, useUpdateInApp,
  type InAppAudience, type InAppDraft, type InAppMessage,
} from '@/services/comms/in-app.api'

/** ISO -> value for <input type="datetime-local"> (local time). */
const toLocalInput = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined)

/** Create (no message) or edit a draft or paused message. */
export function InAppEditor({ message }: { message?: InAppMessage }) {
  const navigate = useNavigate()
  const { can } = useCan()
  const create = useCreateInApp()
  const update = useUpdateInApp()
  const setStatus = useSetInAppStatus()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(message?.title ?? '')
  const [body, setBody] = useState(message?.body ?? '')
  const [imageUrl, setImageUrl] = useState(message?.imageUrl ?? '')
  const [ctaLabel, setCtaLabel] = useState(message?.ctaLabel ?? '')
  const [ctaUrl, setCtaUrl] = useState(message?.ctaUrl ?? '')
  const [backgroundColor, setBg] = useState(message?.backgroundColor ?? SWATCHES[0]!)
  const [audience, setAudience] = useState<InAppAudience>(message?.audience ?? 'users')
  const [startsAt, setStartsAt] = useState(toLocalInput(message?.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(message?.endsAt))
  const [uploading, setUploading] = useState(false)

  const draft: InAppDraft = {
    title: title.trim(), body: body.trim(), backgroundColor, audience,
    imageUrl: imageUrl || undefined,
    ctaLabel: ctaLabel.trim() || undefined,
    ctaUrl: ctaUrl.trim() || undefined,
    startsAt: fromLocalInput(startsAt),
    endsAt: fromLocalInput(endsAt),
  }
  const problems = draftProblems(draft)
  const busy = create.isPending || update.isPending || setStatus.isPending || uploading
  const appLink = APP_LINKS.some((l) => l.value === ctaUrl)

  const pickImage = async (file?: File) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return void toast.error('Use a JPG, PNG or WebP image.')
    if (file.size > IMAGE_MAX_BYTES) return void toast.error('The image must be 5 MB or smaller.')
    setUploading(true)
    try {
      setImageUrl(await uploadInAppImage(file))
    } catch {
      toast.error("Couldn't upload the image. Try again.")
    } finally {
      setUploading(false)
    }
  }

  const save = async (goLive: boolean) => {
    const saved = message
      ? (await update.mutateAsync({ id: message.id, draft })).data
      : (await create.mutateAsync(draft)).data
    if (goLive) await setStatus.mutateAsync({ id: saved.id, status: 'live' })
    navigate({ to: '/comms/in-app' })
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rise grid gap-5 rounded-xl border bg-card p-5">
        <Field>
          <FieldLabel>Who sees it</FieldLabel>
          <ToggleGroup value={[audience]} onValueChange={(v) => v[0] && setAudience(v[0] as InAppAudience)} variant="outline">
            {AUDIENCES.map((a) => <ToggleGroupItem key={a.value} value={a.value}>{a.label}</ToggleGroupItem>)}
          </ToggleGroup>
          <FieldDescription>{AUDIENCES.find((a) => a.value === audience)?.hint}. Each person sees it once, the next time they open it.</FieldDescription>
        </Field>

        <Field data-invalid={title.length > IN_APP_LIMITS.title}>
          <FieldLabel htmlFor="ia-title">Title</FieldLabel>
          <Input id="ia-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend deals are here" />
          <FieldDescription>{title.length} / {IN_APP_LIMITS.title}</FieldDescription>
        </Field>

        <Field data-invalid={body.length > IN_APP_LIMITS.body}>
          <FieldLabel htmlFor="ia-body">Message</FieldLabel>
          <Textarea id="ia-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <FieldDescription>{body.length} / {IN_APP_LIMITS.body}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Image (optional)</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            {imageUrl && <img src={imageUrl} alt="" className="h-16 rounded-lg border object-contain" />}
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {imageUrl ? 'Replace' : 'Upload image'}
            </Button>
            {imageUrl && (
              <Button type="button" variant="ghost" onClick={() => setImageUrl('')}><Trash2 /> Remove</Button>
            )}
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden"
              onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <FieldDescription>JPG, PNG or WebP, up to 5 MB. A transparent PNG looks best on the colour.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Background colour</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setBg(c)}
                className={cn('size-8 rounded-full border', backgroundColor.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ring ring-offset-2 ring-offset-card')}
                style={{ backgroundColor: c }} />
            ))}
            <Input aria-label="Custom colour" value={backgroundColor} onChange={(e) => setBg(e.target.value)} className="w-28 font-mono" />
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <Field data-invalid={ctaLabel.length > IN_APP_LIMITS.cta}>
            <FieldLabel htmlFor="ia-cta">Button label (optional)</FieldLabel>
            <Input id="ia-cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Book now" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ia-link">Button opens</FieldLabel>
            <div className="flex gap-2">
              <NativeSelect aria-label="Button opens" value={appLink ? ctaUrl : 'https'}
                onChange={(e) => setCtaUrl(e.target.value === 'https' ? 'https://' : e.target.value)}>
                {APP_LINKS.map((l) => <NativeSelectOption key={l.value} value={l.value}>{l.label}</NativeSelectOption>)}
                <NativeSelectOption value="https">A web link</NativeSelectOption>
              </NativeSelect>
              {!appLink && <Input id="ia-link" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://autovogue.app/..." />}
            </div>
            <FieldDescription>App screens only open in the AutoVogue app; vendors and staff see the button only for web links.</FieldDescription>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ia-start">Starts (optional)</FieldLabel>
            <Input id="ia-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <FieldDescription>Empty: as soon as it goes live.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ia-end">Expires (optional)</FieldLabel>
            <Input id="ia-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            <FieldDescription>After this nobody sees it, even people who never opened it.</FieldDescription>
          </Field>
        </div>

        {problems.length > 0 && (title || body) && (
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>{problems.map((p) => <p key={p}>{p}</p>)}</div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button variant="outline" render={<Link to="/comms/in-app" />} nativeButton={false}>Cancel</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || problems.length > 0} onClick={() => void save(false)}>
              Save draft
            </Button>
            {can('broadcasts.send') && (
              <Button disabled={busy || problems.length > 0} onClick={() => void save(true)}>
                Save and go live
              </Button>
            )}
          </div>
        </div>
      </section>

      <aside className="grid gap-3 xl:sticky xl:top-20">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
        <div className="rounded-2xl bg-black/60 p-5">
          <InAppCard title={title} body={body} imageUrl={imageUrl || undefined} ctaLabel={ctaLabel || undefined} backgroundColor={/^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : '#7EA6E0'} compact />
        </div>
        <p className="text-xs text-muted-foreground">Shown over the app or dashboard. Several live messages show one after another, oldest first.</p>
      </aside>
    </div>
  )
}
