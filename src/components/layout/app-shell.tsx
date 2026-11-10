import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { LogOut, Menu, Moon, Search, Sun, UserCog } from 'lucide-react'
import { BlackLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandPalette } from './command-palette'
import { NAV, type NavItem } from './nav'
import { useCan } from '@/hooks/use-can'
import { useAttention } from '@/services/overview/overview.api'
import { useSupportCounts } from '@/services/support/support.api'
import { authApi } from '@/services/auth/auth.api'
import { APP_ENV } from '@/lib/env'
import { cn } from '@/lib/utils'

export function EnvBanner() {
  if (APP_ENV === 'production') return null
  return (
    <div className="sticky top-0 z-40 flex h-6 items-center justify-center gap-2 bg-staging text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0d14]">
      {APP_ENV === 'staging' ? 'Staging: test money, test data' : 'Local development'}
    </div>
  )
}

function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useCan()
  const { pathname } = useLocation()
  const { data: attention } = useAttention()
  const { data: support } = useSupportCounts(can('support.view'))
  const badgeOf = (key?: string) => (key === 'support' ? support?.unassigned : key ? attention?.badges[key] : undefined)
  const visible = (i: { perms?: string[] }) => !i.perms || can(...i.perms)
  const counts = Object.fromEntries((attention?.items ?? []).map((i) => [i.key, i.count]))

  return (
    <nav className="rail-glow flex h-full flex-col border-r border-rail-border text-rail-foreground">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <BlackLogo className="h-8 w-auto text-rail-strong!" />
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold">Control</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-rail-muted">Admin platform</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.filter(visible).map((item) => (
          <RailItem key={item.label} item={item} pathname={pathname} badge={badgeOf(item.badge)} counts={counts} visible={visible} onNavigate={onNavigate} />
        ))}
      </div>
      <p className="px-5 pb-4 text-[10px] text-rail-muted">Every action here is logged.</p>
    </nav>
  )
}

function CountBadge({ n }: { n?: number }) {
  if (!n) return null
  return <span className="rounded-full bg-staging px-1.5 py-px text-[10px] font-bold text-[#0a0d14] tabular">{n > 99 ? '99+' : n}</span>
}

function RailItem({ item, pathname, badge, counts, visible, onNavigate }: {
  item: NavItem
  pathname: string
  badge?: number
  counts: Record<string, number>
  visible: (i: { perms?: string[] }) => boolean
  onNavigate?: () => void
}) {
  const section = '/' + (item.to.split('/')[1] ?? '')
  const active = item.to === '/' ? pathname === '/' : pathname.startsWith(section)
  const children = item.children?.filter(visible)
  return (
    <div className="mb-0.5">
      <Link
        to={children?.[0]?.to ?? item.to}
        onClick={onNavigate}
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-rail-foreground/75 transition hover:bg-rail-accent hover:text-rail-strong',
          active && 'bg-rail-accent text-rail-strong shadow-[inset_2px_0_0_var(--ring)]',
        )}
      >
        <item.icon className="size-4 opacity-80" />
        <span className="flex-1">{item.label}</span>
        <CountBadge n={badge} />
      </Link>
      {active && children && children.length > 1 && (
        <div className="ml-[22px] mt-0.5 grid border-l border-rail-border pl-3">
          {children.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              onClick={onNavigate}
              className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-rail-muted transition hover:text-rail-strong', pathname.startsWith(c.to) && 'font-semibold text-rail-strong')}
            >
              <span className="flex-1">{c.label}</span>
              <CountBadge n={c.attention?.reduce((sum, k) => sum + (counts[k] ?? 0), 0)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { me } = useCan()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      // "/" opens search too, unless the person is typing somewhere.
      const t = e.target as HTMLElement | null
      const typing = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const signOut = async () => {
    await authApi.logout()
    qc.clear()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-dvh bg-background">
      <EnvBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block">
          <Rail />
        </aside>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 border-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Rail onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition hover:border-ring/40"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Find a booking, person, plate or page</span>
              <span className="kbd hidden sm:inline-flex">/</span><span className="kbd hidden sm:inline-flex">⌘K</span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-2" />}>
                  <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {me?.fullName?.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <span className="hidden text-left leading-tight md:block">
                    <span className="block text-xs font-semibold">{me?.fullName}</span>
                    <span className="block text-[10px] text-muted-foreground">{me?.roles.map((r) => r.name).join(', ')}</span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{me?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: '/settings/account' })}>
                    <UserCog /> My account and sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={signOut}>
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="surface-grid min-h-[calc(100dvh-3.5rem)] px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
