import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const port = Number(process.env.CAPTURE_PORT || 4180)
const server = spawn(`npm run dev -- --port ${port}`, { stdio: 'ignore', shell: true })
const base = `http://127.0.0.1:${port}`
const slug = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  await mkdir('docs/images/en', { recursive: true }); await mkdir('docs/images/pt', { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(base, { waitUntil: 'networkidle' })
  const buttons = page.locator('.topbar nav button')
  const count = await buttons.count()
  for (let index = 0; index < count; index++) {
    const button = buttons.nth(index); const name = slug(await button.innerText())
    await button.click(); await page.waitForTimeout(350)
    await page.screenshot({ path: `docs/images/en/${name}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'PT' }).click(); await page.waitForTimeout(250)
  await page.screenshot({ path: 'docs/images/pt/overview.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload({ waitUntil: 'networkidle' })
  await page.screenshot({ path: 'docs/images/mobile.png', fullPage: true })
  await browser.close()
} finally {
  server.kill('SIGTERM')
}
