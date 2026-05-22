export type EventStatus =
  | { kind: 'upcoming'; days: number; hours: number; minutes: number }
  | { kind: 'in_progress' }
  | { kind: 'completed' }
  | { kind: 'undated' }

const MINUTE = 60_000

// Derives an event's status from its start (and optional end) relative to `now`.
// Point events (no end) go straight from the countdown to "completed" at start time.
export function eventStatus(
  startsAt: string | null,
  endsAt: string | null,
  now: number = Date.now(),
): EventStatus {
  if (!startsAt) {
    return { kind: 'undated' }
  }
  const start = new Date(startsAt).getTime()
  const end = endsAt ? new Date(endsAt).getTime() : null

  if (now < start) {
    const totalMinutes = Math.floor((start - now) / MINUTE)
    return {
      kind: 'upcoming',
      days: Math.floor(totalMinutes / 1440),
      hours: Math.floor((totalMinutes % 1440) / 60),
      minutes: totalMinutes % 60,
    }
  }

  if (end !== null && now < end) {
    return { kind: 'in_progress' }
  }

  return { kind: 'completed' }
}

// Human-readable lead time, showing the two most significant non-zero units.
export function formatCountdown(status: Extract<EventStatus, { kind: 'upcoming' }>): string {
  const { days, hours, minutes } = status
  if (days > 0) {
    return `in ${days}d ${hours}h`
  }
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `in ${minutes}m`
  }
  return 'starting now'
}
