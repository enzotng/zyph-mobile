import { render, screen } from '@testing-library/react-native'

import type { TripEvent } from '@/features/timeline'

import { RightNowCard } from './right-now-card'

function makeEvent(overrides: Partial<TripEvent> = {}): TripEvent {
  return {
    id: 'e1',
    trip_id: 't1',
    title: 'Tram 28 sightseeing',
    type: 'transport',
    starts_at: '2026-06-15T11:00:00Z',
    ends_at: '2026-06-15T13:00:00Z',
    location: null,
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TripEvent
}

const NOW = new Date('2026-06-15T12:00:00Z').getTime()

describe('RightNowCard', () => {
  it('renders the right-now label, the in-progress status and the event title', () => {
    render(<RightNowCard event={makeEvent()} now={NOW} />)

    expect(screen.getByText('Right now')).toBeOnTheScreen()
    expect(screen.getByText('In progress')).toBeOnTheScreen()
    expect(screen.getByText('Tram 28 sightseeing')).toBeOnTheScreen()
  })

  it('shows the minutes left when under an hour remains', () => {
    render(<RightNowCard event={makeEvent({ ends_at: '2026-06-15T12:38:00Z' })} now={NOW} />)

    expect(screen.getByText('38m left')).toBeOnTheScreen()
  })

  it('shows hours and minutes left when more than an hour remains', () => {
    render(<RightNowCard event={makeEvent({ ends_at: '2026-06-15T13:20:00Z' })} now={NOW} />)

    expect(screen.getByText('1h 20m left')).toBeOnTheScreen()
  })

  it('omits the time-left label when the event has no end', () => {
    render(<RightNowCard event={makeEvent({ ends_at: null })} now={NOW} />)

    expect(screen.queryByText(/left/)).toBeNull()
  })
})
