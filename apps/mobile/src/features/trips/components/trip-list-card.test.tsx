import { fireEvent, render, screen } from '@testing-library/react-native'

import { haptics } from '@/lib/haptics'

import type { TripCard, TripMemberLite } from '../api/trips.api'
import { TripListCard } from './trip-list-card'

jest.mock('@/lib/haptics', () => ({
  haptics: {
    light: jest.fn(),
    medium: jest.fn(),
    selection: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}))

// Builds a TripMemberLite with sensible defaults; override per-test.
function makeMember(overrides: Partial<TripMemberLite> = {}): TripMemberLite {
  return {
    id: 'member-1',
    user_id: 'user-1',
    display_name: 'Alice',
    avatar_url: null,
    role: 'member',
    status: 'active',
    ...overrides,
  }
}

// Builds a fully-shaped TripCard; override only the fields a test cares about.
function makeTrip(overrides: Partial<TripCard> = {}): TripCard {
  return {
    id: 'trip-1',
    title: 'Summer in Lisbon',
    destination: 'Lisbon',
    currency: 'EUR',
    latitude: null,
    longitude: null,
    cover_photo_url: null,
    cover_photo_author: null,
    cover_photo_author_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    owner_id: 'owner-1',
    invite_code: 'ABC123',
    start_date: '2026-06-14',
    end_date: '2026-06-16',
    members: [makeMember()],
    myBalanceCents: 0,
    ...overrides,
  }
}

// expo-image renders to this host component under jest-expo (matches city-image.test).
const EXPO_IMAGE_TYPE = 'ViewManagerAdapter_ExpoImage'

function hasNodeOfType(json: unknown, type: string): boolean {
  if (!json || typeof json !== 'object') {
    return false
  }
  const node = json as { type?: string; children?: unknown[] }
  if (node.type === type) {
    return true
  }
  return (node.children ?? []).some((child) => hasNodeOfType(child, type))
}

function renderedHasImage(): boolean {
  return hasNodeOfType(screen.toJSON(), EXPO_IMAGE_TYPE)
}

describe('TripListCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the trip title', () => {
    render(<TripListCard trip={makeTrip()} onPress={() => {}} />)

    expect(screen.getByText('Summer in Lisbon')).toBeOnTheScreen()
  })

  it('uses the title as the accessibility label on a button', () => {
    render(<TripListCard trip={makeTrip({ title: 'Roadtrip' })} onPress={() => {}} />)

    expect(screen.getByRole('button', { name: 'Roadtrip' })).toBeOnTheScreen()
  })

  it('calls onPress when the card is pressed', () => {
    const onPress = jest.fn()
    render(<TripListCard trip={makeTrip({ title: 'Tap me' })} onPress={onPress} />)

    fireEvent.press(screen.getByRole('button', { name: 'Tap me' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('fires a light haptic when the card is pressed', () => {
    render(<TripListCard trip={makeTrip({ title: 'Buzz me' })} onPress={() => {}} />)

    fireEvent.press(screen.getByRole('button', { name: 'Buzz me' }))

    expect(haptics.light).toHaveBeenCalledTimes(1)
  })

  it('handles the press lifecycle (pressIn/pressOut) without throwing', () => {
    const onPress = jest.fn()
    render(<TripListCard trip={makeTrip()} onPress={onPress} />)

    const button = screen.getByRole('button', { name: 'Summer in Lisbon' })

    // Drives the Pressable through its full press lifecycle. The resolved style
    // function `({ pressed }) => [...]` only re-evaluates the pressed branch under
    // the native press responder, which is absent in jsdom; the branch is left
    // uncovered intentionally (overall branch coverage stays >= 90%).
    expect(() => {
      fireEvent(button, 'pressIn')
      fireEvent(button, 'pressOut')
      fireEvent.press(button)
    }).not.toThrow()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  // --- destination branch ---

  it('renders the destination row when a destination is present', () => {
    render(<TripListCard trip={makeTrip({ destination: 'Porto' })} onPress={() => {}} />)

    expect(screen.getByText('Porto')).toBeOnTheScreen()
  })

  it('does not render a destination row when destination is null', () => {
    render(<TripListCard trip={makeTrip({ destination: null })} onPress={() => {}} />)

    expect(screen.queryByText('Lisbon')).toBeNull()
  })

  // --- balance tone / label branches ---

  it('shows the "owed" label and a positive balance', () => {
    render(
      <TripListCard
        trip={makeTrip({ myBalanceCents: 1250, currency: 'EUR' })}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('You’re owed 12.50 EUR')).toBeOnTheScreen()
  })

  it('shows the "owe" label with an absolute amount for a negative balance', () => {
    render(
      <TripListCard
        trip={makeTrip({ myBalanceCents: -850, currency: 'USD' })}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('You owe 8.50 USD')).toBeOnTheScreen()
  })

  it('shows the "settled" label for a zero balance', () => {
    render(<TripListCard trip={makeTrip({ myBalanceCents: 0 })} onPress={() => {}} />)

    expect(screen.getByText('All settled up')).toBeOnTheScreen()
  })

  // --- members branch ---

  it('renders the avatar stack when there are members', () => {
    render(
      <TripListCard
        trip={makeTrip({ members: [makeMember({ id: 'm1', display_name: 'Alice' })] })}
        onPress={() => {}}
      />,
    )

    // Avatar uses the display_name as its accessibility label.
    expect(screen.getByLabelText('Alice')).toBeOnTheScreen()
  })

  it('maps a null display_name to undefined (no name label) without crashing', () => {
    render(
      <TripListCard
        trip={makeTrip({ members: [makeMember({ id: 'm1', display_name: null })] })}
        onPress={() => {}}
      />,
    )

    // Falls back to the "?" initial when no name is provided.
    expect(screen.getByText('?')).toBeOnTheScreen()
  })

  it('does not render an avatar stack when there are no members', () => {
    render(<TripListCard trip={makeTrip({ members: [] })} onPress={() => {}} />)

    expect(screen.queryByLabelText('Alice')).toBeNull()
  })

  // --- dates branch ---

  it('renders the dates row when the trip has a start date', () => {
    render(
      <TripListCard
        trip={makeTrip({ start_date: '2026-06-14', end_date: '2026-06-16' })}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('14 - Jun 16')).toBeOnTheScreen()
  })

  it('renders a single date when start and end are equal', () => {
    render(
      <TripListCard
        trip={makeTrip({ start_date: '2026-06-14', end_date: '2026-06-14' })}
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('Jun 14')).toBeOnTheScreen()
  })

  it('renders no dates row when the trip has no start date', () => {
    render(
      <TripListCard trip={makeTrip({ start_date: null, end_date: null })} onPress={() => {}} />,
    )

    // The "settled" badge still renders, but no calendar date text.
    expect(screen.getByText('All settled up')).toBeOnTheScreen()
    expect(screen.queryByText('14 - Jun 16')).toBeNull()
  })

  // --- cover photo branch ---

  it('renders the cover photo when cover_photo_url is set', () => {
    render(
      <TripListCard
        trip={makeTrip({ cover_photo_url: 'https://example.com/lisbon.jpg' })}
        onPress={() => {}}
      />,
    )

    expect(renderedHasImage()).toBe(true)
  })

  it('renders the colour fallback cover when cover_photo_url is null', () => {
    render(<TripListCard trip={makeTrip({ cover_photo_url: null })} onPress={() => {}} />)

    expect(renderedHasImage()).toBe(false)
  })

  // --- seed fallback (destination ?? title) ---

  it('renders without throwing when destination is null (seed falls back to title)', () => {
    expect(() =>
      render(
        <TripListCard
          trip={makeTrip({ destination: null, title: 'Untitled Trip' })}
          onPress={() => {}}
        />,
      ),
    ).not.toThrow()
    expect(screen.getByText('Untitled Trip')).toBeOnTheScreen()
  })
})
