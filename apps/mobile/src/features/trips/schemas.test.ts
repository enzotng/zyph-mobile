import { createTripSchema, dateToIsoDay, isoDayToDate } from './schemas'

const base = { title: 'Rome', destination: '', currency: 'EUR', startDate: null, endDate: null }

describe('createTripSchema', () => {
  it('requires a title', () => {
    expect(createTripSchema.safeParse({ ...base, title: '' }).success).toBe(false)
  })

  it('accepts a valid trip without dates', () => {
    expect(createTripSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a currency that is not 3 letters', () => {
    expect(createTripSchema.safeParse({ ...base, currency: 'EU' }).success).toBe(false)
  })

  it('accepts an end date on or after the start date', () => {
    expect(
      createTripSchema.safeParse({ ...base, startDate: '2026-06-10', endDate: '2026-06-12' })
        .success,
    ).toBe(true)
    expect(
      createTripSchema.safeParse({ ...base, startDate: '2026-06-10', endDate: '2026-06-10' })
        .success,
    ).toBe(true)
  })

  it('rejects an end date before the start date', () => {
    expect(
      createTripSchema.safeParse({ ...base, startDate: '2026-06-12', endDate: '2026-06-10' })
        .success,
    ).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(createTripSchema.safeParse({ ...base, startDate: '10/06/2026' }).success).toBe(false)
  })
})

describe('date helpers', () => {
  it('formats a Date to a local YYYY-MM-DD day (no UTC drift)', () => {
    expect(dateToIsoDay(new Date(2026, 5, 14))).toBe('2026-06-14')
    expect(dateToIsoDay(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('parses a YYYY-MM-DD day to a local midnight Date', () => {
    const d = isoDayToDate('2026-06-14')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(14)
  })

  it('round-trips a day string', () => {
    expect(dateToIsoDay(isoDayToDate('2026-12-31'))).toBe('2026-12-31')
  })
})
