import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouter } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StepUpDialog } from '@/components/auth/step-up-dialog'
import { onSessionExpired } from '@/services/session'
import { QUERY_KEYS } from '@/services/query.keys'
import appCss from '@/styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
      { name: 'theme-color', content: '#0a0d14' },
      { title: 'AutoVogue Admin' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Plus+Jakarta+Sans:wght@400..800&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  shellComponent: Shell,
  component: App,
})

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function App() {
  const { queryClient } = Route.useRouteContext()
  const router = useRouter()

  useEffect(() => {
    // Any request that finds the session gone sends the person to sign in.
    onSessionExpired((reason) => {
      queryClient.setQueryData([QUERY_KEYS.ME], null)
      const here = router.state.location.href
      if (!router.state.location.pathname.startsWith('/login')) {
        toast.warning(reason)
        router.navigate({ to: '/login', search: { redirect: here } })
      }
    })
    return () => onSessionExpired(null)
  }, [queryClient, router])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="av-admin-theme" disableTransitionOnChange>
        <TooltipProvider delay={200}>
          <Outlet />
          <StepUpDialog />
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
