import type { TripCard } from './api/trips.api'
import { daysUntil, selectHomeTrips, statusTone, tripTimeline } from './select'

function trip(id: string, start: string | null, end: string | null = null): TripCard {
  return {
    id,
    title: id,
    start_date: start,
    end_date: end,
    currency: 'EUR',
    members: [],
    myBalanceCents: 0,
  } as unknown as TripCard
}

// 4 June 2026, local calendar.
const NOW = new Date(2026, 5, 4)

describe('daysUntil', () => {
  it('counts whole local days to a future date', () => {
    expect(daysUntil('2026-06-14', NOW)).toBe(10)
  })

  it('is 0 today and negative in the past', () => {
    expect(daysUntil('2026-06-04', NOW)).toBe(0)
    expect(daysUntil('2026-06-01', NOW)).toBe(-3)
  })
})

describe('tripTimeline', () => {
  it('classifies upcoming / in-progress / past / undated', () => {
    expect(tripTimeline(trip('a', '2026-06-14'), NOW)).toBe('upcoming')
    expect(tripTimeline(trip('b', '2026-06-02', '2026-06-06'), NOW)).toBe('in_progress')
    expect(tripTimeline(trip('c', '2026-05-01', '2026-05-05'), NOW)).toBe('past')
    expect(tripTimeline(trip('d', null), NOW)).toBe('undated')
  })

  it('treats a single-day trip today as in progress', () => {
    expect(tripTimeline(trip('e', '2026-06-04'), NOW)).toBe('in_progress')
  })
})

describe('statusTone', () => {
  it('warns for imminent upcoming and is success otherwise', () => {
    expect(statusTone(trip('a', '2026-06-07'), NOW)).toBe('warning')
    expect(statusTone(trip('b', '2026-06-20'), NOW)).toBe('success')
    expect(statusTone(trip('c', '2026-06-02', '2026-06-06'), NOW)).toBe('success')
    expect(statusTone(trip('d', '2026-05-01', '2026-05-02'), NOW)).toBe('muted')
  })
})

describe('selectHomeTrips', () => {
  it('picks the soonest live trip as next, the rest as upcoming, past separately', () => {
    const trips = [
      trip('far', '2026-08-01'),
      trip('soon', '2026-06-10'),
      trip('past', '2026-01-01', '2026-01-05'),
      trip('undated', null),
    ]
    const { next, upcoming, past } = selectHomeTrips(trips, NOW)
    expect(next?.id).toBe('soon')
    expect(upcoming.map((item) => item.id)).toEqual(['far'])
    expect(past.map((item) => item.id).sort()).toEqual(['past', 'undated'])
  })

  it('prioritises an in-progress trip as next', () => {
    const trips = [trip('upcoming', '2026-06-10'), trip('live', '2026-06-03', '2026-06-08')]
    expect(selectHomeTrips(trips, NOW).next?.id).toBe('live')
  })

  it('returns a null next when nothing is live', () => {
    expect(selectHomeTrips([trip('p', '2026-01-01', '2026-01-02')], NOW).next).toBeNull()
  })
})
