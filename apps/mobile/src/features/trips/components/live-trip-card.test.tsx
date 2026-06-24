import { fireEvent, render, screen } from '@testing-library/react-native'

import { useEvents } from '@/features/timeline'

import type { TripCard, TripMemberLite } from '../api/trips.api'
import { LiveTripCard } from './live-trip-card'

// LiveTripCard fetches the trip's events to build the NEXT row; stub the hook (and the supabase
// client the real timeline module would otherwise pull in) so the card renders deterministically.
jest.mock('@/lib/supabase')
jest.mock('@/features/timeline', () => {
  const actual = jest.requireActual('@/features/timeline')
  return { ...actual, useEvents: jest.fn() }
})

const useEventsMock = useEvents as jest.Mock

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
    destination: 'Lisbon',
    start_date: '2026-06-01',
    end_date: '2026-06-03',
    latitude: null,
    longitude: null,
    id: 't1',
    invite_code: 'ABC123',
    owner_id: 'owner1',
    title: 'Lisbon weekend',
    updated_at: '2026-01-01T00:00:00.000Z',
    members: [makeMember()],
    myBalanceCents: 0,
    ...overrides,
  }
}

// 2 June 2026, between the 1st and the 3rd -> Day 2 of 3.
const NOW = new Date(2026, 5, 2)

describe('LiveTripCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useEventsMock.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders the live badge, title and day counter', () => {
    render(<LiveTripCard trip={makeTrip()} now={NOW} onPress={() => {}} />)

    expect(screen.getByText('Live now')).toBeOnTheScreen()
    expect(screen.getByText('Lisbon weekend')).toBeOnTheScreen()
    expect(screen.getByText('Day 2 of 3')).toBeOnTheScreen()
  })

  it('falls back to an "Open trip" row when there is no upcoming event', () => {
    render(<LiveTripCard trip={makeTrip()} now={NOW} onPress={() => {}} />)

    expect(screen.getByText('Open trip')).toBeOnTheScreen()
  })

  it('shows the soonest upcoming event in the NEXT row', () => {
    useEventsMock.mockReturnValue({
      data: [
        {
          id: 'e1',
          trip_id: 't1',
          title: 'Dinner, Time Out',
          type: 'restaurant',
          starts_at: new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString(),
          ends_at: null,
        },
      ],
      isLoading: false,
    })

    render(<LiveTripCard trip={makeTrip()} now={NOW} onPress={() => {}} />)

    expect(screen.getByText('Dinner, Time Out')).toBeOnTheScreen()
    expect(screen.queryByText('Open trip')).toBeNull()
  })

  it('calls onPress when the card is pressed', () => {
    const onPress = jest.fn()
    render(<LiveTripCard trip={makeTrip()} now={NOW} onPress={onPress} />)

    fireEvent.press(screen.getByRole('button', { name: 'Lisbon weekend, Live now, Lisbon' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
