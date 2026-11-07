import { expect, test } from '@playwright/test'
import { API_URL, need } from './env'
import { signIn, stepUpIfAsked, watchErrors } from './helpers'

test('signed-out visitors are sent to the sign-in page', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  await page.goto('/bookings')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

test('the shell sends a strict CSP and security headers', async ({ page }) => {
  const res = await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  test.skip(!csp, 'dev server: the CSP meta tag is added by build:local')
  const scriptSrc = csp!.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
  expect(scriptSrc).toContain("'sha256-")
  expect(scriptSrc).not.toContain("'unsafe-inline'")
  expect(scriptSrc).not.toContain("'unsafe-eval'")
  expect(res?.headers()['x-frame-options']).toBe('DENY')
})

test('command palette finds a page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder(/booking reference/i).fill('reconciliation')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/money\/reconciliation/)
})

test('a reason is required before rejecting a destructive action', async ({ page }) => {
  await page.goto('/settings/platform')
  const sw = page.getByRole('switch').first()
  await sw.click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: /pause|resume|confirm/i }).last()
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('textbox').fill('abc')
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('kill switch: pause and resume withdrawals (with step-up), public status follows', async ({ page, request }) => {
  const secret = need('E2E_ADMIN_TOTP_SECRET')
  const errors = watchErrors(page)
  await page.goto('/settings/platform')
  const row = page.locator('li, tr, div').filter({ hasText: /withdrawals/i }).filter({ has: page.getByRole('switch') }).last()
  const sw = row.getByRole('switch')
  const statusOf = async () => (await (await request.get(`${API_URL()}/status`)).json()).data

  const before = await statusOf()
  test.skip(before.withdrawalsPaused, 'withdrawals are already paused locally; resume them first')

  for (const [want, reason] of [[true, 'e2e: checking the withdrawals switch'], [false, 'e2e: switch check finished, resume']] as const) {
    await sw.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill(reason)
    await dialog.getByRole('button', { name: /pause|resume|confirm/i }).last().click()
    await stepUpIfAsked(page, secret)
    await expect(sw).toHaveAttribute('aria-checked', String(want), { timeout: 15_000 })
    await expect.poll(async () => (await statusOf()).withdrawalsPaused, { timeout: 70_000 }).toBe(want)
  }
  expect(errors).toEqual([])
})

test('reports: charts render and an export downloads', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Payments' }).click()
  expect((await download).suggestedFilename()).toMatch(/payments.*\.csv/)
})
