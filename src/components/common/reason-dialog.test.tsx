import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReasonDialog } from './reason-dialog'

describe('ReasonDialog', () => {
  it('says what will happen and needs a 5 to 500 character reason', async () => {
    const onConfirm = vi.fn()
    render(<ReasonDialog open onOpenChange={() => {}} title="Suspend vendor" consequence="Their cars leave the marketplace." confirmLabel="Suspend" onConfirm={onConfirm} />)
    expect(screen.getByText('Their cars leave the marketplace.')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Suspend' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), 'abc')
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), 'd fraud report')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('abcd fraud report')
  })

  it('refuses a reason over 500 characters', async () => {
    render(<ReasonDialog open onOpenChange={() => {}} title="T" consequence="C" confirmLabel="Go" onConfirm={() => {}} />)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('x'.repeat(501))
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
  })
})
