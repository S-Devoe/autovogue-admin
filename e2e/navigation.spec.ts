import { expect, test } from '@playwright/test'
import { watchErrors } from './helpers'

// Every screen loads with a heading, without script errors and without CSP violations.
const PAGES: [string, RegExp][] = [
  ['/', /good (morning|afternoon|evening)/i],
  ['/verification/users', /users/i],
  ['/verification/vehicles', /vehicle/i],
  ['/verification/pending-checks', /prembly|check/i],
  ['/verification/expiring', /expir/i],
  ['/verification/name-changes', /name changes/i],
  ['/bookings', /bookings/i],
  ['/money/payouts', /payouts/i],
  ['/money/payments', /payments/i],
  ['/money/refunds', /refunds/i],
  ['/money/reconciliation', /reconciliation/i],
  ['/money/wallets', /wallets/i],
  ['/money/ledger', /commission|ledger/i],
  ['/disputes', /dispute/i],
  ['/support', /support/i],
  ['/people/users', /users/i],
  ['/people/vendors', /vendors/i],
  ['/people/waitlist', /waitlist/i],
  ['/listings', /cars|listings/i],
  ['/trust/reviews', /review/i],
  ['/comms/email', /email campaigns/i],
  ['/comms/push', /push campaigns/i],
  ['/comms/email/new', /new email campaign/i],
  ['/comms/push/new', /new push campaign/i],
  ['/reports', /marketplace/i],
  ['/settings/platform', /platform/i],
  ['/settings/approvals', /approvals/i],
  ['/settings/staff', /staff/i],
  ['/settings/roles', /roles/i],
  ['/settings/audit', /audit/i],
  ['/settings/content', /content/i],
  ['/settings/access-review', /access review/i],
  ['/settings/retention', /retention/i],
  ['/settings/privacy', /privacy/i],
  ['/settings/account', /account/i],
]

for (const [path, heading] of PAGES) {
  test(`loads ${path}`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
}
