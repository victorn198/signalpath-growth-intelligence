import { describe, expect, it } from 'vitest'
import { concentrationStats, largestStageReachGap, trendStats } from './innovation'

describe('SignalPath analytical contracts', () => {
  it('describes the largest adjacent reach gap without inferring abandonment', () => {
    const gap=largestStageReachGap([{stage:'View',users:100},{stage:'Cart',users:55},{stage:'Purchase',users:40}])
    expect(gap).toMatchObject({from:'View',to:'Cart',gap:45,gapRate:.45})
  })

  it('calculates time movement from first to last point', () => {
    expect(trendStats([{label:'A',value:10},{label:'B',value:15},{label:'C',value:20}])).toMatchObject({mean:15,first:10,last:20,change:1,points:3})
  })

  it('uses the full scoped denominator for concentration', () => {
    const result=concentrationStats([{name:'A',value:30},{name:'B',value:20}],100)
    expect(result.top3Share).toBe(.5)
    expect(result.displayedShare).toBe(.5)
  })
})
