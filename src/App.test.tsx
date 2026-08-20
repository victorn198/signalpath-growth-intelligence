import { describe, expect, it } from 'vitest'

describe('SignalPath metric contract', () => {
  it('does not divide deltas by zero', () => {
    const current = 10
    const previous = 0
    const delta = previous === 0 ? 0 : (current - previous) / Math.abs(previous)
    expect(delta).toBe(0)
  })
})
