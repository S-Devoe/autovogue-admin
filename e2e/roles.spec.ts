import { expect, test, type Browser } from '@playwright/test'
import { API_URL } from './env'
import { signIn, watchErrors } from './helpers'

// PRD 11: key flows as each default role. What each role may do comes from
// the API's role matrix (auto-vogue-go/test/testdata/role_matrix.golden);
// here we check that the admin shows the right sections and the API agrees.
type RoleCase = {
  role: 'OPERATIONS' | 'FINANCE' | 'SUPPORT' | 'AUDITOR'
  sees: string[]
  hidden: string[]
  allowed: string[]
  refused: string[]
}

const CASES: RoleCase[] = [
  {
    role: 'OPERATIONS',
    sees: ['Verification', 'Bookings', 'Disputes', 'People', 'Listings', 'Comms'],
    hidden: ['Staff', 'Payouts'],
    allowed: ['platform/verification/renters', 'platform/campaigns?channel=push', 'platform/disputes'],
    refused: ['platform/payouts', 'platform/config', 'platform/staff'],
  },
  {
    role: 'FINANCE',
    sees: ['Money', 'Bookings', 'Disputes'],
    hidden: ['Verification', 'Comms', 'Staff'],
    allowed: ['platform/payouts', 'platform/config', 'platform/ledger'],
    refused: ['platform/verification/renters', 'platform/campaigns?channel=push', 'platform/staff'],
  },
  {
    role: 'SUPPORT',
    sees: ['Verification', 'Bookings', 'Disputes', 'Comms'],
    hidden: ['Platform', 'Payouts', 'Staff'],
    allowed: ['platform/bookings', 'platform/verification/renters'],
    refused: ['platform/config', 'platform/payouts', 'platform/staff'],
  },
  {
    role: 'AUDITOR',
    sees: ['Verification', 'Bookings', 'Money', 'Disputes', 'Settings'],
    hidden: ['Comms'],
    allowed: ['platform/staff', 'platform/payouts', 'platform/config', 'platform/audit'],
    refused: ['platform/campaigns?channel=push'],
  },
]

async function roleContext(browser: Browser, role: RoleCase['role']) {
  const email = process.env[`E2E_${role}_EMAIL`]
  const password = process.env[`E2E_${role}_PASSWORD`]
  const secret = process.env[`E2E_${role}_TOTP_SECRET`]
  test.skip(!email || !password || !secret, `set E2E_${role}_* in e2e/.env to run`)
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  await signIn(page, email!, password!, secret!)
  return { ctx, page }
}

for (const c of CASES) {
  test(`${c.role.toLowerCase()}: sees its sections and the API enforces the rest`, async ({ browser }) => {
    const { ctx, page } = await roleContext(browser, c.role)
    const errors = watchErrors(page)
    const nav = page.getByRole('navigation').first()
    // Links with a badge read "Bookings 1", so match the start of the name.
    const link = (label: string) => nav.getByRole('link', { name: new RegExp(`^${label}(\\s|$)`) })
    for (const label of c.sees) await expect(link(label).first(), `${label} visible`).toBeVisible()
    for (const label of c.hidden) await expect(link(label), `${label} hidden`).toHaveCount(0)
    for (const path of c.allowed) expect((await page.request.get(`${API_URL()}/${path}`)).status(), path).toBe(200)
    for (const path of c.refused) expect((await page.request.get(`${API_URL()}/${path}`)).status(), path).toBe(403)
    // The overview loads for everyone with only their own work.
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })
}

test('auditor can read but not change: a write is refused', async ({ browser }) => {
  const { ctx, page } = await roleContext(browser, 'AUDITOR')
  const me = await (await page.request.get(`${API_URL()}/auth/platform/me`)).json()
  const res = await page.request.post(`${API_URL()}/platform/config/proposals`, {
    headers: { 'X-CSRF-Token': me.data.csrfToken, 'Idempotency-Key': `e2e-${Date.now()}` },
    data: { key: 'money.approval_threshold_kobo', value: '100', reason: 'e2e auditor write check' },
  })
  expect(res.status()).toBe(403)
  await ctx.close()
})
