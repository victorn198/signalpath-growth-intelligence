// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { cappedScenario, changeDrivers, concentrationStats, largestStageReachGap, PageInsight, rankSegments, trendStats } from './innovation'
import type { BreakdownRow, Lang } from './types'

afterEach(cleanup)

const values = { users: 100, purchasers: 95, conversion: .95, orders: 190, revenue: 1900, returningUsers: 95, return: .95, productRevenue: 600, productUnits: 300 }
const breakdown: BreakdownRow[] = [{ name: 'A', value: 90, share: .3 }, { name: 'B', value: 80, share: 80 / 300 }]
const props = { values, breakdown, detail: [], referenceDetail: [], trend: [], lang: 'en' as Lang }
function open(pageId: string, tab: string, extra: Partial<typeof props> = {}) {
  render(<PageInsight pageId={pageId} {...props} {...extra} />)
  fireEvent.click(screen.getByRole('tab', { name: tab }))
}
function stat(label: string) {
  const element = screen.getByText(label).closest('article')
  expect(element).not.toBeNull()
  return element?.querySelector('strong')?.textContent
}

describe('Analytical boundary contracts', () => {
  it('uses full membership shares, not a unique-user or displayed-row denominator', () => {
    expect(concentrationStats(breakdown).top3Share).toBeCloseTo(170 / 300)
    expect(concentrationStats(breakdown).displayedShare).toBeCloseTo(170 / 300)
    expect(concentrationStats([{ name: 'A', value: 90 }, { name: 'B', value: 80 }, { name: 'C', value: 70 }, { name: 'D', value: 60 }]).top3Share).toBe(.8)
    expect(concentrationStats([]).displayedShare).toBeNull()
    expect(concentrationStats(breakdown, 0).displayedShare).toBeNull()
  })

  it.each([
    [{ users: 100 }, { stage: 'purchase', users: 20 }],
    [{ stage: 'view', users: 100 }, { stage: 'purchase' }],
    [{ stage: 'view', users: '' }, { stage: 'purchase', users: 20 }],
    [{ stage: 'view', users: NaN }, { stage: 'purchase', users: 20 }],
    [{ stage: 'view', users: -1 }, { stage: 'purchase', users: 20 }],
  ])('rejects malformed stage rows instead of filling missing counts with zero', (...rows) => {
    expect(largestStageReachGap(rows)).toBeNull()
  })

  it('allows increasing independent event reach and preserves an undefined relative gap', () => {
    expect(largestStageReachGap([{ stage: 'view', users: 40 }, { stage: 'purchase', users: 100 }])).toMatchObject({ gap: 60, gapRate: 1.5 })
    expect(largestStageReachGap([{ stage: 'view', users: 0 }, { stage: 'purchase', users: 100 }])).toMatchObject({ gap: 100, gapRate: null })
    expect(largestStageReachGap([])).toBeNull()
  })

  it('does not turn unavailable comparisons into zero movement', () => {
    expect(changeDrivers([{ name: 'A', value: 10 }])).toEqual([])
    expect(changeDrivers([{ name: 'A', value: 10, previous: 0 }])[0].change).toBe(10)
    expect(trendStats([{ label: 'A', value: 0 }, { label: 'B', value: 10 }]).change).toBeNull()
    expect(trendStats([{ label: 'A', value: 0 }, { label: 'B', value: 0 }]).change).toBeNull()
    expect(trendStats([]).change).toBeNull()
    expect(trendStats([{ label: 'A', value: 10 }]).change).toBeNull()
  })

  it('enforces conversion sample boundaries and rejects missing names or rates', () => {
    const valid = { driver: 'Eligible', active_users: 100, purchasers: 5, conversion_pct: 5 }
    expect(rankSegments([
      valid, { driver: 'Tiny', active_users: 99, purchasers: 90, conversion_pct: 91 },
      { driver: 'Rare', active_users: 100, purchasers: 4, conversion_pct: 4 },
      { active_users: 100, purchasers: 100, conversion_pct: 100 },
      { driver: 'Missing', active_users: 100, purchasers: 10 },
      { ...valid, driver: 'Empty', conversion_pct: '' },
    ], 'conversion_pct')).toEqual([valid])
  })

  it('requires 100 users but not purchasers for return rankings', () => {
    const valid = { driver: 'Eligible', active_users: 100, return_pct: 0 }
    expect(rankSegments([valid, { driver: 'Tiny', active_users: 99, return_pct: 100 }, { driver: 'Missing', active_users: 200 }], 'return_pct')).toEqual([valid])
  })

  it('caps the rate and incremental counts using the same simulated population', () => {
    expect(cappedScenario(100, 95, 30)).toEqual({ rate: 1, incremental: 5, relative: 5 / 95 })
    expect(cappedScenario(100, 100, 30)).toEqual({ rate: 1, incremental: 0, relative: 0 })
    expect(cappedScenario(100, 50, 10).rate).toBeCloseTo(.55)
    expect(cappedScenario(100, 50, 10).incremental).toBeCloseTo(5)
    expect(cappedScenario(0, 0, 10)).toEqual({ rate: 0, incremental: 0, relative: 0 })
  })
})

describe('Bilingual lens presentation', () => {
  it.each(['en', 'pt'] as const)('shows executive user labels and unavailable comparisons in %s', lang => {
    render(<PageInsight pageId="executive" {...props} lang={lang} />)
    expect(screen.getByText(lang === 'pt' ? 'Quais segmentos moveram usuários?' : 'Which segments moved users?')).toBeTruthy()
    expect(screen.getByText(lang === 'pt' ? 'Sem comparação disponível.' : 'No comparison available.')).toBeTruthy()
  })

  it('uses membership shares in the executive concentration lens', () => {
    open('executive', 'Concentration')
    expect(stat('Top 3 · share')).toBe('56.7%')
    expect(screen.getByText(/not unique users/)).toBeTruthy()
  })

  it('caps executive conversion, purchasers and revenue together', () => {
    open('executive', 'Scenario')
    expect(stat('simulated conversion')).toBe('100.0%')
    expect(stat('incremental purchasers')).toBe('+5')
    expect(stat('incremental revenue')).toBe('+$100')
    expect(screen.getByText(/Not a forecast/)).toBeTruthy()
  })

  it('caps funnel incremental orders consistently with conversion', () => {
    open('funnel', 'Conversion recovery')
    expect(stat('incremental purchasers')).toBe('+5')
    expect(stat('incremental purchase records')).toBe('+10')
    expect(stat('incremental revenue')).toBe('+$100')
  })

  it('caps return counts consistently with the displayed rate', () => {
    open('retention', 'Repeat recovery')
    expect(stat('incremental returning users')).toBe('+5')
    expect(stat('simulated rate')).toBe('100.0%')
  })

  it('uses runtime revenue and purchase records with full product mart totals, never top-20 order sums', () => {
    render(<PageInsight {...props} pageId="products" detail={[{ product: 'Top item', orders: 1, units: 2, revenue: 3 }]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Purchase and item totals' }))
    expect(stat('revenue per purchase record')).toBe('$10')
    expect(stat('item units · full mart')).toBe('300')
    expect(stat('item revenue · full mart')).toBe('$600')
    expect(screen.queryByText('units per purchase')).toBeNull()
  })

  it('uses product revenue rather than event revenue in product concentration', () => {
    open('products', 'Concentration')
    expect(stat('Top 3 · share')).toBe('28.3%')
    expect(stat('item revenue · full mart')).toBe('$600')
  })

  it('selects stage counts by explicit keys instead of row order', () => {
    render(<PageInsight {...props} pageId="funnel" referenceDetail={[{ stage: 'purchase', users: 30 }, { stage: 'session_start', users: 100 }]} />)
    expect(stat('users who started a session · full source')).toBe('100')
    expect(stat('users with a purchase · full source')).toBe('30')
    expect(screen.getByText(/Independent event-user counts/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Reach gap' }))
    expect(stat('absolute reach difference')).toBe('70')
    expect(screen.queryByText('stage abandonment')).toBeNull()
  })

  it('shows no ranking when all segments are ineligible', () => {
    open('acquisition', 'Channel quality')
    expect(stat('highest-converting channel')).toBe('—')
    expect(screen.getByText(/at least 100 users and 5 purchasers/)).toBeTruthy()
  })

  it.each([
    { sessionRevenue: 336422, productRevenue: 328475, expected: '$7,947' },
    { sessionRevenue: 56670, productRevenue: 55240, expected: '$1,430' },
  ])('shows the actual legacy mart discrepancy, without claiming reconciliation', ({ expected, ...totals }) => {
    open('trust', 'Reconciliation scope', { values: { ...values, ...totals } } as Partial<typeof props>)
    expect(stat('discrepancy · sessions minus items')).toBe(expected)
    expect(screen.getByText(/Raw facts unavailable/)).toBeTruthy()
    expect(screen.getByText(/cannot be certified/)).toBeTruthy()
  })
})
