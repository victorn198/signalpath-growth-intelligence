import { describe, expect, it } from 'vitest'
import { concentrationStats, largestStageLeak, trendStats } from './innovation'

describe('SignalPath analytical contracts', () => {
  it('finds the largest adjacent journey loss', () => {
    const leak=largestStageLeak([{stage:'View',users:100},{stage:'Cart',users:55},{stage:'Purchase',users:40}])
    expect(leak).toMatchObject({from:'View',to:'Cart',loss:45,lossRate:.45})
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
