import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoneyInput } from './money-input'

function Harness({ onKobo }: { onKobo: (k: number) => void }) {
  const [kobo, setKobo] = useState(0)
  return <MoneyInput id="amt" kobo={kobo} onChange={(k) => { setKobo(k); onKobo(k) }} max={5000000} />
}

describe('MoneyInput', () => {
  it('lets staff type naira with kobo and keeps integer kobo underneath', async () => {
    let last = -1
    render(<Harness onKobo={(k) => (last = k)} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '1,500.50')
    expect(input).toHaveValue('1,500.50')
    expect(last).toBe(150050)
  })

  it('handles a trailing point and clearing', async () => {
    let last = -1
    render(<Harness onKobo={(k) => (last = k)} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '20.')
    expect(input).toHaveValue('20.')
    expect(last).toBe(2000)
    await userEvent.clear(input)
    expect(last).toBe(0)
  })

  it('shows the limit', () => {
    render(<Harness onKobo={() => {}} />)
    expect(screen.getByText(/Up to/)).toHaveTextContent('Up to ₦50,000.00')
  })
})

describe('MoneyInput limits', () => {
  it('refuses a third decimal place and a second point, and flags amounts over the limit', async () => {
    let last = -1
    render(<Harness onKobo={(k) => (last = k)} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '10.555')
    expect(input).toHaveValue('10.55')
    await userEvent.type(input, '.')
    expect(input).toHaveValue('10.55')
    expect(last).toBe(1055)
    await userEvent.clear(input)
    await userEvent.type(input, '60000')
    expect(screen.getByText(/more than allowed/)).toBeInTheDocument()
  })
})
