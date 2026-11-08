import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { StaffInAppMessages } from '@/components/comms/in-app-bits'
import { meQueryOptions } from '@/services/auth/auth.api'

/** Every signed-in screen. No session: go to sign-in and come back after. */
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions)
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { me }
  },
  component: () => (
    <AppShell>
      <Outlet />
      <StaffInAppMessages />
    </AppShell>
  ),
})
