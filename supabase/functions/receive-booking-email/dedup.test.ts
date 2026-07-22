import { dedupSignature } from './dedup'

const TRIP_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('dedupSignature', () => {
  it('is stable for the same event', () => {
    const event = { startsAt: '2026-08-01T10:30:00.000Z', title: 'Flight to Oslo' }

    expect(dedupSignature(TRIP_ID, event)).toBe(dedupSignature(TRIP_ID, event))
  })

  it('extracts the day (YYYY-MM-DD) from the ISO startsAt', () => {
    const event = { startsAt: '2026-08-01T23:59:59.000Z', title: 'Flight to Oslo' }

    expect(dedupSignature(TRIP_ID, event)).toBe(`${TRIP_ID}:2026-08-01:flighttooslo`)
  })

  it('normalizes the title: strips accents, punctuation and lower-cases', () => {
    const event = { startsAt: '2026-08-02T08:00:00.000Z', title: "Hôtel Château - Réservation !" }

    expect(dedupSignature(TRIP_ID, event)).toBe(`${TRIP_ID}:2026-08-02:hotelchateaureservat`)
  })

  it('produces different signatures for two same-day events with different titles', () => {
    const a = dedupSignature(TRIP_ID, { startsAt: '2026-08-03T09:00:00.000Z', title: 'Flight AB123' })
    const b = dedupSignature(TRIP_ID, { startsAt: '2026-08-03T18:00:00.000Z', title: 'Hotel Grand' })

    expect(a).not.toBe(b)
  })
})
