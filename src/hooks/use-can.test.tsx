import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { api, ok, server } from '@/test/msw'
import { useCan } from './use-can'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function RefundButton() {
  const { can, me } = useCan()
  if (!me) return <p>loading</p>
  return can('refunds.create') ? <button>Refund</button> : <p>No refund access</p>
}

const renderWith = (permissions: string[]) => {
  server.use(http.get(api('auth/platform/me'), () => HttpResponse.json(ok({ id: 's1', email: 'a@b.c', fullName: 'A', permissions, roles: [], csrfToken: 'x' }))))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><RefundButton /></QueryClientProvider>)
}

describe('useCan hides what the role cannot do', () => {
  it('shows the action with the permission', async () => {
    renderWith(['refunds.create'])
    expect(await screen.findByRole('button', { name: 'Refund' })).toBeInTheDocument()
  })
  it('hides it without', async () => {
    renderWith(['bookings.view'])
    expect(await screen.findByText('No refund access')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull()
  })
})
