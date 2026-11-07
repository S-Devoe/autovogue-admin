import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { initMonitoring } from './lib/monitoring'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  if (typeof window !== 'undefined') initMonitoring()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  })
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
