import type { TripEvent } from './api/timeline.api'

export type TimelineItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'event'; key: string; event: TripEvent }

export function formatEventDay(iso: string | null): string {
  if (!iso) {
    return 'No date'
  }
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Local-timezone day key (YYYY-MM-DD) so grouping matches the displayed label.
function localDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

// Flattens chronologically-sorted events into [header, ...events] sections by day,
// ready for a single FlashList. Undated events fall under a trailing "No date" group.
export function groupEventsByDay(events: TripEvent[]): TimelineItem[] {
  const items: TimelineItem[] = []
  let lastDay: string | null = null

  for (const event of events) {
    const day = event.starts_at ? localDayKey(event.starts_at) : 'undated'
    if (day !== lastDay) {
      items.push({ kind: 'header', key: `header-${day}`, label: formatEventDay(event.starts_at) })
      lastDay = day
    }
    items.push({ kind: 'event', key: event.id, event })
  }

  return items
}
