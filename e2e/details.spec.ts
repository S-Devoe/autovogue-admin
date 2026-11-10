import { expect, test } from '@playwright/test'
import { watchErrors } from './helpers'

// Opens real records, not just lists: from each list, the first few rows'
// detail pages must render with no crash, no error screen and no CSP
// violation. Run `make seed/admin-fixtures` in the API repo first so there
// are paid, disputed, refunded and failed-payout bookings to open.
const LISTS: { list: string; link: RegExp; min: number }[] = [
  { list: '/bookings', link: /^\/bookings\/[0-9A-Z]{26}$/, min: 3 },
  { list: '/disputes', link: /^\/disputes\/[0-9A-Z]{26}$/, min: 1 },
  { list: '/support?tab=active', link: /^\/support\/[0-9A-Z]{26}$/, min: 0 },
  { list: '/listings', link: /^\/listings\/[0-9A-Z]{26}$/, min: 1 },
  { list: '/people/users', link: /^\/people\/users\/[0-9A-Z]{26}$/, min: 1 },
  { list: '/people/vendors', link: /^\/people\/vendors\/[0-9A-Z]{26}$/, min: 1 },
  { list: '/settings/roles', link: /^\/settings\/roles\/[\w-]+$/, min: 1 },
  { list: '/comms/push', link: /^\/comms\/push\/[0-9A-Z]{26}$/, min: 0 },
  { list: '/comms/email', link: /^\/comms\/email\/[0-9A-Z]{26}$/, min: 0 },
]

async function detailLinks(page: import('@playwright/test').Page, list: string, re: RegExp) {
  await page.goto(list)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))
  const rows = await page.locator('tr[class*="cursor-pointer"]').count()
  return { links: [...new Set(hrefs.filter((h) => re.test(h)))].slice(0, 4), rows }
}

for (const { list, link, min } of LISTS) {
  test(`opens records from ${list}`, async ({ page }) => {
    let { links, rows } = await detailLinks(page, list, link)
    // Some lists open a record by clicking the row instead of a link.
    if (links.length === 0 && rows > 0) {
      const opened: string[] = []
      for (let i = 0; i < Math.min(rows, 3); i++) {
        await page.goto(list)
        await page.locator('tr[class*="cursor-pointer"]').nth(i).click()
        await page.waitForURL((u) => link.test(u.pathname))
        opened.push(new URL(page.url()).pathname)
      }
      links = opened
    }
    expect(links.length, `records to open on ${list} (load the fixtures)`).toBeGreaterThanOrEqual(min)
    for (const href of links) {
      const errors = watchErrors(page)
      await page.goto(href)
      await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Something went wrong'), href).toHaveCount(0)
      expect(errors, href).toEqual([])
    }
  })
}

test('dispute workspace shows the statement and the resolve action', async ({ page }) => {
  await page.goto('/disputes')
  const row = page.locator('tr[class*="cursor-pointer"], tbody a[href^="/disputes/"]').first()
  test.skip(!(await row.waitFor({ timeout: 10_000 }).then(() => true, () => false)), 'no disputes: run make seed/admin-fixtures')
  await row.click()
  await page.waitForURL((u) => /^\/disputes\/[0-9A-Z]{26}$/.test(u.pathname))
  await expect(page.getByText(/dent on the rear door/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /resolve/i }).first()).toBeVisible()
})
