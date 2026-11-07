import { test as setup } from '@playwright/test'
import { need } from './env'
import { signIn } from './helpers'

setup('sign in as the admin', async ({ page }) => {
  await signIn(page, need('E2E_ADMIN_EMAIL'), need('E2E_ADMIN_PASSWORD'), need('E2E_ADMIN_TOTP_SECRET'))
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
