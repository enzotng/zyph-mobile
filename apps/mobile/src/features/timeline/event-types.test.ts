import { EVENT_TYPES, eventTypeIcon } from './event-types'

describe('eventTypeIcon', () => {
  it('maps known types to their icons', () => {
    expect(eventTypeIcon('flight')).toBe('airplane')
    expect(eventTypeIcon('lodging')).toBe('bed')
    expect(eventTypeIcon('transport')).toBe('car')
    expect(eventTypeIcon('activity')).toBe('ticket')
    expect(eventTypeIcon('food')).toBe('restaurant')
    expect(eventTypeIcon('event')).toBe('calendar')
  })

  it('aliases the Smart Import "hotel" type to the lodging icon', () => {
    expect(eventTypeIcon('hotel')).toBe('bed')
  })

  it('falls back to calendar for unknown, empty, null or undefined', () => {
    expect(eventTypeIcon('mystery')).toBe('calendar')
    expect(eventTypeIcon('')).toBe('calendar')
    expect(eventTypeIcon(null)).toBe('calendar')
    expect(eventTypeIcon(undefined)).toBe('calendar')
  })

  it('exposes the canonical picker types in order', () => {
    expect(EVENT_TYPES).toEqual(['flight', 'lodging', 'transport', 'activity', 'food', 'event'])
  })
})
