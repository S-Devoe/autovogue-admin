import { cn } from '@/lib/utils'
import { titleCase } from '@/lib/format'

export type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success' | 'info'

const toneClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-secondary text-secondary-foreground',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
}

/** Compact status label with a tone dot. */
export function Pill({ tone = 'neutral', children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap', toneClass[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}

const TONES: Record<string, Tone> = {
  // booking status
  PENDING_APPROVAL: 'info', PENDING_PAYMENT: 'warning', CONFIRMED: 'brand', ACTIVE: 'success', COMPLETED: 'neutral',
  CANCELLED: 'neutral', DISPUTED: 'danger', PAYMENT_FAILED: 'danger',
  // fund state
  PENDING: 'warning', HELD: 'brand', HELD_DISPUTED: 'danger', RELEASING: 'info', RELEASED: 'success',
  PARTIALLY_RELEASED: 'success', REFUNDED: 'neutral', EXPIRED: 'neutral', FAILED: 'danger',
  // documents / kyc
  pending: 'warning', verified: 'success', rejected: 'danger', failed: 'danger',
  PENDING_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger',
  // disputes
  open: 'danger', under_review: 'warning', resolved: 'success', closed: 'neutral',
  // support tickets
  in_progress: 'warning', awaiting_reply: 'info',
  // accounts / listings
  active: 'success', suspended: 'danger', deactivated: 'neutral', AVAILABLE: 'success', RENTED: 'info',
  MAINTENANCE: 'warning', CLEANING: 'info', RETIRED: 'neutral', DRAFT: 'neutral',
  // approvals
  approved: 'success', cancelled: 'neutral',
  draft: 'neutral', sending: 'info', sent: 'success',
  // campaigns
  scheduled: 'brand', paused: 'warning',
  // in-app messages
  live: 'success', ended: 'neutral', expired: 'neutral',
}

export function StatusPill({ value, label }: { value?: string | null; label?: string }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  return <Pill tone={TONES[value] ?? 'neutral'}>{label ?? titleCase(value)}</Pill>
}
