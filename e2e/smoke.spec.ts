import { expect, test } from '@playwright/test'

test('landing page renders create/join controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Mobile Command Table' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create New Room' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible()
})
