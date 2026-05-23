import { formatDistance, formatWalkingTime } from './format'

describe('formatDistance', () => {
  it('formats sub-10 meters precisely', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(7)).toBe('7 m')
  })

  it('rounds meters under 1 km to the nearest 5 m', () => {
    expect(formatDistance(123)).toBe('125 m')
    expect(formatDistance(347)).toBe('345 m')
    expect(formatDistance(999)).toBe('1000 m')
  })

  it('formats km with one decimal under 10 km', () => {
    expect(formatDistance(1_240)).toBe('1.2 km')
    expect(formatDistance(9_950)).toMatch(/^(9\.9|10\.0) km$/)
  })

  it('rounds large distances to whole km', () => {
    expect(formatDistance(12_300)).toBe('12 km')
    expect(formatDistance(343_000)).toBe('343 km')
  })

  it('returns a dash for invalid input', () => {
    expect(formatDistance(Number.NaN)).toBe('—')
    expect(formatDistance(-1)).toBe('—')
  })
})

describe('formatWalkingTime', () => {
  it('returns <1 min for very short distances', () => {
    expect(formatWalkingTime(50)).toBe('<1 min')
  })

  it('returns minutes for moderate distances', () => {
    expect(formatWalkingTime(1_000)).toMatch(/min$/)
  })

  it('switches to hours past 60 min', () => {
    expect(formatWalkingTime(10_000)).toContain('h')
  })

  it('returns dash for invalid input', () => {
    expect(formatWalkingTime(Number.NaN)).toBe('—')
  })
})
