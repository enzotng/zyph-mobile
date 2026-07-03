import type { TripEvent } from './api/timeline.api'
import { groupEventsByDay } from './group'

function makeEvent(id: string, startsAt: string | null): TripEvent {
  return {
    id,
    trip_id: 'trip',
    title: id,
    type: 'event',
    starts_at: startsAt,
    location: null,
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as TripEvent
}

describe('groupEventsByDay', () => {
  it('inserts one header per distinct day', () => {
    const items = groupEventsByDay(
      [
        makeEvent('a', '2026-04-15T09:00:00Z'),
        makeEvent('b', '2026-04-15T18:00:00Z'),
        makeEvent('c', '2026-04-16T10:00:00Z'),
      ],
      'en',
      'No date',
    )
    expect(items.map((item) => item.kind)).toEqual(['header', 'event', 'event', 'header', 'event'])
  })

  it('groups undated events under a "No date" header', () => {
    const items = groupEventsByDay([makeEvent('a', null)], 'en', 'No date')
    expect(items[0]).toMatchObject({ kind: 'header', label: 'No date' })
  })

  it('returns an empty list when there are no events', () => {
    expect(groupEventsByDay([], 'en', 'No date')).toEqual([])
  })
})
