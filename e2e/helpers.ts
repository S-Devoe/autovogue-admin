import { expect, type Page } from '@playwright/test'
import { freshCode } from './env'

export async function signIn(page: Page, email: string, password: string, secret: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()
  const code = await freshCode(secret)
  await page.locator('input[data-input-otp], input[autocomplete="one-time-code"]').first().fill(code)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

/** Fails the test on uncaught errors and CSP violations. */
export function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    const t = m.text()
    // Old local seed rows still point at Cloudinary (images now live on R2);
    // the CSP blocking those is correct, so they don't fail the run.
    if (/Loading the image 'https:\/\/res\.cloudinary\.com/.test(t)) return
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(t)) errors.push(`csp: ${t}`)
  })
  return errors
}

/** Types an authenticator code into the step-up dialog when it appears. */
export async function stepUpIfAsked(page: Page, secret: string) {
  const dialog = page.getByRole('dialog').filter({ hasText: /authenticator/i })
  if (await dialog.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
    await dialog.locator('input').first().fill(await freshCode(secret))
  }
}
