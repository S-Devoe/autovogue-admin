import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface StatCardItem {
  key: string
  label: string
  value?: number
  /** Small line under the number. */
  sub?: string
  /** Colour the number when it is not zero. */
  tone?: 'danger' | 'warning'
  /** The list is filtered to this card right now. */
  active?: boolean
  /** Filters the list; cards without it are read only. */
  onClick?: () => void
}

const COLS: Record<number, string> = {
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-3 lg:grid-cols-5',
  6: 'sm:grid-cols-3 lg:grid-cols-6',
  7: 'sm:grid-cols-4 xl:grid-cols-7',
  8: 'sm:grid-cols-4 xl:grid-cols-8',
  9: 'sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9',
  10: 'sm:grid-cols-5 2xl:grid-cols-10',
}

/** Count cards above a list. Tapping one filters the list to it. */
export function StatCards({ items, loading }: { items: StatCardItem[]; loading?: boolean }) {
  return (
    <div className={cn('mb-5 grid grid-cols-2 gap-3', COLS[items.length] ?? 'sm:grid-cols-4')}>
      {items.map((c) => {
        const body = (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p
                className={cn(
                  'mt-1.5 font-display text-xl font-semibold tabular',
                  c.value ? (c.tone === 'danger' ? 'text-danger' : c.tone === 'warning' ? 'text-warning' : '') : '',
                )}
              >
                {c.value ?? '-'}
              </p>
            )}
            {c.sub && <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>}
          </>
        )
        // Top-aligned for buttons and plain cards alike (buttons centre by default).
        const base = 'rise flex flex-col items-start justify-start rounded-xl border bg-card p-4 text-left'
        return c.onClick ? (
          <button
            key={c.key}
            type="button"
            aria-pressed={!!c.active}
            onClick={c.onClick}
            className={cn(
              base,
              'transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              c.active && 'border-foreground/60 ring-1 ring-foreground/20',
            )}
          >
            {body}
          </button>
        ) : (
          <div key={c.key} className={base}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
