import { BlackLogo } from '@/components/brand/logo'
import { EnvBanner } from '@/components/layout/app-shell'

/** Split sign-in layout: brand rail on the left, the form on the right. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <EnvBanner />
      <div className="grid min-h-[calc(100dvh-1.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="rail-glow relative hidden flex-col justify-between overflow-hidden p-10 text-rail-foreground lg:flex">
          <BlackLogo className="h-12 w-auto text-[#e7eaf3]!" />
          <div className="relative z-10 max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rail-muted">AutoVogue staff only</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] font-semibold">
              Keep the marketplace safe <span className="text-[#8fa2ff]">and the money correct.</span>
            </h2>
            <p className="mt-4 text-sm text-rail-muted">Verify people and businesses, settle disputes, move money and keep every action on the record.</p>
          </div>
          <ul className="relative z-10 grid gap-2 text-xs text-rail-muted">
            <li>· Two-factor sign-in on every account</li>
            <li>· Every action and document view is logged (NDPR)</li>
            <li>· Sensitive actions ask for a fresh code</li>
          </ul>
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 size-[420px] rounded-full border border-white/5" />
          <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full border border-white/5" />
        </aside>
        <main className="surface-grid flex items-center justify-center px-4 py-12">
          <div className="rise w-full max-w-sm">
            <BlackLogo className="mb-8 h-10 w-auto lg:hidden" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
