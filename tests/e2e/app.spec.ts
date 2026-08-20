import { expect, test } from '@playwright/test'

test('renders, filters, switches language, and fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.brand')).toContainText('SignalPath')
  const before = await page.locator('.metric-card strong').first().innerText()
  await page.locator('select').first().selectOption({ index: 1 })
  await expect.poll(() => page.locator('.metric-card strong').first().innerText(), { timeout: 30000 }).not.toBe(before)
  await page.getByRole('button', { name: 'PT' }).click()
  await expect(page.getByText('Escopo da análise')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
