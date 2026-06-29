import {
  createTripSchema,
  dateToIsoDay,
  isoDayToDate,
  newTripSchema,
  tripPreferencesSchema,
} from './schemas'

const base = {
  title: 'Rome',
  destination: '',
  currency: 'EUR',
  startDate: null,
  endDate: null,
  latitude: null,
  longitude: null,
}

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

describe('newTripSchema', () => {
  it('accepts the create fields with no profile set', () => {
    expect(newTripSchema.safeParse({ ...base, tripType: null, budgetLevel: null }).success).toBe(
      true,
    )
  })

  it('accepts valid trip type and budget level', () => {
    expect(
      newTripSchema.safeParse({ ...base, tripType: 'beach', budgetLevel: 'luxury' }).success,
    ).toBe(true)
  })

  it('rejects an unknown trip type', () => {
    expect(
      newTripSchema.safeParse({ ...base, tripType: 'spaceflight', budgetLevel: null }).success,
    ).toBe(false)
  })

  it('still enforces the date ordering inherited from the base', () => {
    expect(
      newTripSchema.safeParse({
        ...base,
        tripType: null,
        budgetLevel: null,
        startDate: '2026-06-12',
        endDate: '2026-06-10',
      }).success,
    ).toBe(false)
  })
})

describe('tripPreferencesSchema', () => {
  const prefsBase = {
    tripType: null,
    budgetLevel: null,
    budgetTotal: '',
    pace: null,
    interests: [],
    dietary: [],
  }

  it('accepts an empty (unset) profile', () => {
    expect(tripPreferencesSchema.safeParse(prefsBase).success).toBe(true)
  })

  it('accepts a fully filled profile', () => {
    expect(
      tripPreferencesSchema.safeParse({
        tripType: 'city_break',
        budgetLevel: 'medium',
        budgetTotal: '1200.50',
        pace: 'balanced',
        interests: ['food', 'museums'],
        dietary: ['vegan'],
      }).success,
    ).toBe(true)
  })

  it('accepts a comma decimal and rejects a non-numeric budget', () => {
    expect(tripPreferencesSchema.safeParse({ ...prefsBase, budgetTotal: '99,90' }).success).toBe(
      true,
    )
    expect(tripPreferencesSchema.safeParse({ ...prefsBase, budgetTotal: 'abc' }).success).toBe(
      false,
    )
  })

  it('rejects an unknown interest', () => {
    expect(
      tripPreferencesSchema.safeParse({ ...prefsBase, interests: ['teleportation'] }).success,
    ).toBe(false)
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
