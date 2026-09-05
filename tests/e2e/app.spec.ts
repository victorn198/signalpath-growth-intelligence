import { expect, test } from '@playwright/test'

test('renders dynamic metrics, five executive lenses, language and mobile layout', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.brand')).toContainText('SignalPath')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await expect(page.locator('.decision-lab').getByRole('tab')).toHaveCount(5)
  await expect(page.locator('.decision-lab')).toContainText('Which channels moved purchasers?')
  await page.getByRole('tab', { name: 'Efficiency' }).click()
  await expect(page.locator('.decision-lab')).toContainText('Sessions per user')
  await page.getByRole('tab', { name: 'Stability' }).click()
  await expect(page.locator('.decision-lab')).toContainText('coefficient of variation')
  const before=await page.locator('.metric-card strong').first().innerText()
  await page.locator('select').first().selectOption('7')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await expect.poll(()=>page.locator('.metric-card strong').first().innerText()).not.toBe(before)
  await page.getByRole('button',{name:'PT'}).click()
  await expect(page.getByText('Escopo da análise')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})

test('uses a distinct page contract and five distinct lenses for every secondary page', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto('/')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  const pages=page.locator('header nav button')
  const titles=new Set<string>(),series=new Set<string>()
  for(let index=1;index<await pages.count();index+=1){
    await pages.nth(index).click()
    await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
    await expect(page.locator('.query-error')).toHaveCount(0)
    const lab=page.locator('.secondary-lab')
    const tabs=lab.getByRole('tab')
    await expect(tabs).toHaveCount(5)
    const states=new Set<string>()
    for(let tab=0;tab<5;tab+=1){
      await tabs.nth(tab).click()
      states.add(await lab.locator('.page-lens-content').innerText())
    }
    expect(states.size).toBe(5)
    titles.add(await page.locator('.page-head h1').innerText())
    series.add(String(await page.locator('.analysis-grid .chart-viewport').first().getAttribute('data-series-signature')))
  }
  expect(titles.size).toBe(5)
  expect(series.size).toBeGreaterThan(2)
})

test('labels full history without inventing a prior window', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await page.locator('select').first().selectOption('all')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await expect(page.locator('.metric-card .delta.neutral').first()).toContainText('no prior window')
})

test('keeps full-source funnel stages explicit and filtered purchaser behavior separate', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page.getByRole('button',{name:'Funnel & Journey'}).click()
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await expect(page.locator('.secondary-lab')).toContainText('Full-source stages')
  await expect(page.locator('.panel.detail')).toContainText('Full-source reference')
  await expect(page.locator('.analysis-grid .panel').first()).toContainText('Purchasers over time')
})

test('loads the product mart only for Product Performance', async ({ page }) => {
  test.setTimeout(120000)
  const requests:string[]=[]
  page.on('request',request=>{if(request.url().includes('mart_growth_products.parquet'))requests.push(request.url())})
  await page.goto('/')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  expect(requests).toHaveLength(0)
  await page.getByRole('button',{name:'Product Performance'}).click()
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  expect(requests.length).toBeGreaterThan(0)
})
