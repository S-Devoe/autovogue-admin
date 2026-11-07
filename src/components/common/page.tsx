import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function PageHeader({ eyebrow, title, description, actions, crumbs }: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  crumbs?: { label: string; to: string }[]
}) {
  return (
    <header className="rise mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c) => (
              <span key={c.to} className="flex items-center gap-1">
                <Link to={c.to} className="hover:text-foreground">{c.label}</Link>
                <ChevronRight className="size-3" />
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ title, description, actions, children, className, flush }: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={cn('rise rounded-xl border bg-card shadow-[0_1px_0_rgb(10_13_20/0.03)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

export function KV({ items, cols = 2 }: { items: [string, React.ReactNode][]; cols?: 1 | 2 | 3 | 4 }) {
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', grid)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 truncate text-sm tabular">{v ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Empty({ title = 'Nothing here', hint, icon }: { title?: string; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Rows({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-2 p-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function LoadMore({ q }: { q: { hasNextPage?: boolean; isFetchingNextPage?: boolean; fetchNextPage: () => unknown } }) {
  if (!q.hasNextPage) return null
  return (
    <div className="flex justify-center border-t p-3">
      <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
        {q.isFetchingNextPage && <Loader2 className="animate-spin" />}
        Load more
      </Button>
    </div>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px] tracking-tight', className)}>{children}</span>
}

/** Filter bar row above lists. */
export function Filters({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">{children}</div>
}

type PagedQuery<T> = {
  data?: { pages: { items: T[] }[] }
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage: () => Promise<unknown>
}

/**
 * One page of a cursor list at a time (10 rows), with Previous / Next.
 * Pages already loaded are kept, so Previous is instant. A new filter
 * (a new query) starts again at page 1.
 */
export function usePager<T>(q: PagedQuery<T>) {
  const [page, setPage] = useState(0)
  const loaded = q.data?.pages.length ?? 0
  useEffect(() => {
    if (loaded > 0 && page > loaded - 1) setPage(loaded - 1)
    if (loaded <= 1 && page !== 0) setPage(0)
  }, [loaded, page])
  const current = Math.min(page, Math.max(loaded - 1, 0))
  const rows = q.data?.pages[current]?.items ?? []
  const canNext = current + 1 < loaded || !!q.hasNextPage
  const next = async () => {
    if (current + 1 < loaded) return setPage(current + 1)
    await q.fetchNextPage()
    setPage(current + 1)
  }
  const pager = (current > 0 || canNext) ? (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span>Page {current + 1}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft /> Previous</Button>
        <Button variant="outline" size="sm" disabled={!canNext || q.isFetchingNextPage} onClick={next}>
          {q.isFetchingNextPage && <Loader2 className="animate-spin" />} Next <ChevronRight />
        </Button>
      </div>
    </div>
  ) : null
  return { rows, pager, page: current }
}
