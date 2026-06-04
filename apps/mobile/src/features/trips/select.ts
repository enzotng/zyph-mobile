import type { TripCard } from './api/trips.api'
import { isoDayToDate } from './schemas'

const DAY_MS = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Whole-day difference from `now` to a date-only ISO ('YYYY-MM-DD'), on the LOCAL calendar.
// Positive = future, 0 = today, negative = past. Uses isoDayToDate (local) - never the
// UTC-parsing eventStatus - to avoid an off-by-one near midnight in non-UTC zones.
export function daysUntil(startIso: string, now: Date): number {
  return Math.round((startOfDay(isoDayToDate(startIso)) - startOfDay(now)) / DAY_MS)
}

export type TripTimeline = 'upcoming' | 'in_progress' | 'past' | 'undated'

// Date-only classification of a trip relative to `now`. A trip is in progress from its start
// day through its end day inclusive (end falls back to start for single-day trips).
export function tripTimeline(trip: TripCard, now: Date): TripTimeline {
  if (!trip.start_date) {
    return 'undated'
  }
  if (daysUntil(trip.start_date, now) > 0) {
    return 'upcoming'
  }
  return daysUntil(trip.end_date ?? trip.start_date, now) >= 0 ? 'in_progress' : 'past'
}

export type StatusTone = 'success' | 'warning' | 'muted'

// Proximity dot tone: in-progress or far-off upcoming = success, imminent (<= 7 days) =
// warning, past/undated = muted.
export function statusTone(trip: TripCard, now: Date): StatusTone {
  const timeline = tripTimeline(trip, now)
  if (timeline === 'in_progress') {
    return 'success'
  }
  if (timeline === 'upcoming' && trip.start_date) {
    return daysUntil(trip.start_date, now) <= 7 ? 'warning' : 'success'
  }
  return 'muted'
}

export type HomeTrips = {
  // The most relevant trip for the hero: the in-progress one, else the soonest upcoming.
  next: TripCard | null
  // Remaining live (upcoming/in-progress) trips, soonest first - for the "Upcoming" grid.
  upcoming: TripCard[]
  // Past + undated trips - reachable via "See all".
  past: TripCard[]
}

function liveRank(trip: TripCard, now: Date): number {
  // In-progress trips sort ahead of upcoming; within a group, soonest start first.
  const base = tripTimeline(trip, now) === 'in_progress' ? -1_000_000 : 0
  return base + (trip.start_date ? daysUntil(trip.start_date, now) : Number.MAX_SAFE_INTEGER)
}

// Splits trips for the home screen. `now` is passed in (callers read it once via a lazy
// useState initializer) so this stays a pure, testable function.
export function selectHomeTrips(trips: TripCard[], now: Date): HomeTrips {
  const live: TripCard[] = []
  const past: TripCard[] = []
  for (const trip of trips) {
    const timeline = tripTimeline(trip, now)
    if (timeline === 'upcoming' || timeline === 'in_progress') {
      live.push(trip)
    } else {
      past.push(trip)
    }
  }
  live.sort((a, b) => liveRank(a, now) - liveRank(b, now))
  const [next, ...upcoming] = live
  return { next: next ?? null, upcoming, past }
}
