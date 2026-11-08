import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { QUERY_KEYS } from '@/services/query.keys'
import {
  recordMyInApp, textOn, useMyNextInApp,
  type InAppMessage,
} from '@/services/comms/in-app.api'

/**
 * The card people see: same layout as the app and the vendor dashboard.
 * Used for the live preview and for staff's own messages.
 */
export function InAppCard({ title, body, imageUrl, ctaLabel, backgroundColor, onClose, onCta, compact }: {
  title: string
  body: string
  imageUrl?: string
  ctaLabel?: string
  backgroundColor: string
  onClose?: () => void
  onCta?: () => void
  compact?: boolean
}) {
  const fg = textOn(backgroundColor)
  return (
    <div className="relative rounded-3xl p-6 text-center" style={{ backgroundColor, color: fg }}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-3 top-3 grid size-8 place-content-center rounded-full"
        style={{ backgroundColor: fg === '#FFFFFF' ? 'rgb(255 255 255 / 0.14)' : 'rgb(10 13 20 / 0.08)' }}
      >
        <X className="size-4" />
      </button>
      {imageUrl && (
        <img src={imageUrl} alt="" className={compact ? 'mx-auto mb-3 mt-4 max-h-28 rounded-2xl object-contain' : 'mx-auto mb-4 mt-6 max-h-44 rounded-2xl object-contain'} />
      )}
      <p className={`font-display font-bold leading-tight tracking-tight ${compact ? 'mt-6 text-xl' : 'mt-8 text-2xl'}`}>
        {title || 'Your title'}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed opacity-85">{body || 'Your message shows here.'}</p>
      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          className="mt-5 h-11 w-full rounded-xl text-sm font-semibold"
          style={{ backgroundColor: fg, color: backgroundColor }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

/**
 * Shows the signed-in staff member their in-app messages, once each, one
 * after another. Mounted once in the signed-in layout.
 */
export function StaffInAppMessages() {
  const qc = useQueryClient()
  const next = useMyNextInApp()
  const [current, setCurrent] = useState<InAppMessage | null>(null)
  // Messages already shown in this tab: the cached "next" can still hold one
  // for a moment after it is closed, and it must not pop up twice.
  const handled = useRef(new Set<string>())

  useEffect(() => {
    const m = next.data
    if (!m || current || handled.current.has(m.id)) return
    handled.current.add(m.id)
    setCurrent(m)
    // Seen as soon as it is on screen: it never shows again.
    void recordMyInApp(m.id, 'seen').catch(() => {})
  }, [next.data, current])

  const finish = async (action: 'clicked' | 'dismissed') => {
    const m = current
    if (!m) return
    setCurrent(null)
    await recordMyInApp(m.id, action).catch(() => {})
    if (action === 'clicked' && m.ctaUrl?.startsWith('https://')) {
      window.open(m.ctaUrl, '_blank', 'noopener,noreferrer')
    }
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.MY_IN_APP] })
  }

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && finish('dismissed')}>
      <DialogContent showCloseButton={false} className="max-w-md border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{current?.title}</DialogTitle>
        <DialogDescription className="sr-only">{current?.body}</DialogDescription>
        {current && (
          <InAppCard
            title={current.title}
            body={current.body}
            imageUrl={current.imageUrl}
            ctaLabel={current.ctaUrl?.startsWith('https://') ? current.ctaLabel : undefined}
            backgroundColor={current.backgroundColor}
            onClose={() => finish('dismissed')}
            onCta={() => finish('clicked')}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
