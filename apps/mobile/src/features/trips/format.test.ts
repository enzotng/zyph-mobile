import { formatDay, formatTripDates } from './format'

describe('formatTripDates', () => {
  it('returns null without a start date', () => {
    expect(formatTripDates(null, null, 'en')).toBeNull()
  })

  it('formats a single day (no range separator)', () => {
    const label = formatTripDates('2026-06-14', null, 'en')
    expect(label).toContain('14')
    expect(label).not.toContain('-')
  })

  it('formats a same-month range with one month and a separator', () => {
    const label = formatTripDates('2026-06-14', '2026-06-16', 'en')
    expect(label).toContain('14')
    expect(label).toContain('16')
    expect(label).toContain('-')
  })
})

describe('formatDay', () => {
  it('returns null when undated', () => {
    expect(formatDay(null, 'en')).toBeNull()
  })

  it('includes the day number', () => {
    expect(formatDay('2026-06-14', 'en')).toContain('14')
  })
})
