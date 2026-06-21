import { fireEvent, render, screen } from '@testing-library/react-native'

import type { TripCard, TripMemberLite } from '../api/trips.api'
import { UpcomingTripRow } from './upcoming-trip-row'

function makeMember(overrides: Partial<TripMemberLite> = {}): TripMemberLite {
  return {
    id: 'm1',
    user_id: 'u1',
    display_name: 'Alice',
    avatar_url: null,
    role: 'member',
    status: 'active',
    ...overrides,
  }
}

function makeTrip(overrides: Partial<TripCard> = {}): TripCard {
  return {
    cover_photo_author: null,
    cover_photo_author_url: null,
    cover_photo_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    currency: 'EUR',
    destination: 'Berlin',
    end_date: null,
    latitude: null,
    longitude: null,
    id: 't1',
    invite_code: 'ABC123',
    owner_id: 'owner1',
    start_date: '2026-06-10',
    title: 'Berlin weekend',
    updated_at: '2026-01-01T00:00:00.000Z',
    members: [makeMember()],
    myBalanceCents: 0,
    ...overrides,
  }
}

// Fixed reference date: 1 June 2026 (local). start_date 2026-06-10 is 9 whole days away.
const NOW = new Date(2026, 5, 1)

describe('UpcomingTripRow', () => {
  it('renders the trip title', () => {
    render(<UpcomingTripRow trip={makeTrip()} now={NOW} onPress={() => {}} />)

    expect(screen.getByText('Berlin weekend')).toBeOnTheScreen()
  })

  it('renders the "<destination>, in N days" meta', () => {
    render(<UpcomingTripRow trip={makeTrip()} now={NOW} onPress={() => {}} />)

    expect(screen.getByText('Berlin, in 9 days')).toBeOnTheScreen()
  })

  it('renders the "today" meta when the trip starts today or earlier', () => {
    render(
      <UpcomingTripRow
        trip={makeTrip({ start_date: '2026-06-01' })}
        now={NOW}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('Berlin, today')).toBeOnTheScreen()
  })

  it('falls back to the title as the destination when destination is null', () => {
    render(
      <UpcomingTripRow
        trip={makeTrip({ destination: null, title: 'Untitled' })}
        now={NOW}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('Untitled, in 9 days')).toBeOnTheScreen()
  })

  it('calls onPress when the row is pressed', () => {
    const onPress = jest.fn()
    render(<UpcomingTripRow trip={makeTrip()} now={NOW} onPress={onPress} />)

    fireEvent.press(screen.getByRole('button', { name: 'Berlin weekend' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
