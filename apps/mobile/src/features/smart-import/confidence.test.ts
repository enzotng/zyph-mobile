import { confidenceLevel, HIGH_CONFIDENCE, LOW_CONFIDENCE } from './confidence'

describe('confidenceLevel', () => {
  it('returns low below the low threshold', () => {
    expect(confidenceLevel(0)).toBe('low')
    expect(confidenceLevel(LOW_CONFIDENCE - 0.01)).toBe('low')
  })

  it('returns medium between the thresholds', () => {
    expect(confidenceLevel(LOW_CONFIDENCE)).toBe('medium')
    expect(confidenceLevel(HIGH_CONFIDENCE - 0.01)).toBe('medium')
  })

  it('returns high at or above the high threshold', () => {
    expect(confidenceLevel(HIGH_CONFIDENCE)).toBe('high')
    expect(confidenceLevel(1)).toBe('high')
  })
})
