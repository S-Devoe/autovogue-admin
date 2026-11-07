import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// PRD 7: WCAG 2.1 AA on the main screens, light and dark.
const PAGES = ['/', '/verification/users', '/verification/vehicles', '/bookings', '/money/payouts', '/money/payments', '/disputes',
  '/people/users', '/people/vendors', '/listings', '/trust/reviews', '/reports', '/comms/email', '/comms/email/new',
  '/settings/platform', '/settings/staff', '/settings/roles', '/settings/audit', '/settings/privacy', '/settings/retention']

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`a11y ${theme} ${path}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch { /* ignore */ } }, theme)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const issues = r.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(' ')}`)
      expect(issues, issues.join('\n')).toEqual([])
    })
  }
}
