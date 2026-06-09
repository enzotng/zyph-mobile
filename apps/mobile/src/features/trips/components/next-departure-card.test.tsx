import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import { haptics } from '@/lib/haptics'

import type { TripCard, TripMemberLite } from '../api/trips.api'
import { NextDepartureCard } from './next-departure-card'

// expo-image renders to this host component under jest-expo (matches city-image.test.tsx).
const EXPO_IMAGE_TYPE = 'ViewManagerAdapter_ExpoImage'

function hasNodeOfType(node: ReactTestRendererJSON | null, type: string): boolean {
  if (!node) {
    return false
  }
  if (node.type === type) {
    return true
  }
  return (node.children ?? []).some((child) =>
    typeof child === 'string' ? false : hasNodeOfType(child, type),
  )
}

function renderedHasImage(): boolean {
  return hasNodeOfType(screen.toJSON() as ReactTestRendererJSON | null, EXPO_IMAGE_TYPE)
}

// Minimal active member; overridable per case (e.g. null display_name).
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

// A fully-typed TripCard (Trip Row + members + balance), overridable per case.
function makeTrip(overrides: Partial<TripCard> = {}): TripCard {
  return {
    cover_photo_author: null,
    cover_photo_author_url: null,
    cover_photo_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    currency: 'EUR',
    destination: 'Paris',
    end_date: null,
    latitude: null,
    longitude: null,
    id: 't1',
    invite_code: 'ABC123',
    owner_id: 'owner1',
    start_date: '2026-06-14',
    title: 'Summer in Paris',
    updated_at: '2026-01-01T00:00:00.000Z',
    members: [makeMember()],
    myBalanceCents: 0,
    ...overrides,
  }
}

describe('NextDepartureCard', () => {
  it('renders the title, the next-departure tag and the destination', () => {
    render(
      <NextDepartureCard
        trip={makeTrip()}
        days={5}
        inProgress={false}
        departureLabel="14 juin"
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('Summer in Paris')).toBeOnTheScreen()
    expect(screen.getByText('Next departure')).toBeOnTheScreen()
    expect(screen.getByText('Paris')).toBeOnTheScreen()
  })

  it('calls onPress and fires light haptics when the card is pressed', () => {
    const lightSpy = jest.spyOn(haptics, 'light').mockImplementation(() => {})
    const onPress = jest.fn()
    render(
      <NextDepartureCard
        trip={makeTrip()}
        days={5}
        inProgress={false}
        departureLabel="14 juin"
        onPress={onPress}
      />,
    )

    // The a11y label composes the visible title, countdown and destination.
    fireEvent.press(screen.getByRole('button', { name: 'Summer in Paris, D-5, Paris' }))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(lightSpy).toHaveBeenCalledTimes(1)

    lightSpy.mockRestore()
  })

  it('applies the pressed style (subtle scale + dim) while pressed, then clears it', () => {
    render(
      <NextDepartureCard
        trip={makeTrip()}
        days={5}
        inProgress={false}
        departureLabel="14 juin"
        onPress={() => {}}
      />,
    )

    // The Pressable is the single node carrying a function style; resolve both
    // branches of the pressed-style ternary directly.
    const [pressable] = screen.UNSAFE_root.findAll(
      (node) => typeof (node.props as { style?: unknown }).style === 'function',
    )
    const styleFn = pressable.props.style as (state: { pressed: boolean }) => unknown

    expect(styleFn({ pressed: true })).toEqual({ opacity: 0.92, transform: [{ scale: 0.98 }] })
    expect(styleFn({ pressed: false })).toBeUndefined()
  })

  describe('countdown', () => {
    it('shows the in-progress label when inProgress is true', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={3}
          inProgress={true}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText('In progress')).toBeOnTheScreen()
    })

    it('shows "Today" when not in progress and days is 0', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={0}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText('Today')).toBeOnTheScreen()
    })

    it('shows the D- countdown when not in progress and days is greater than 0', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={7}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText('D-7')).toBeOnTheScreen()
    })
  })

  describe('departure label', () => {
    it('shows the departure label when present and not in progress', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText('14 juin')).toBeOnTheScreen()
    })

    it('hides the departure label when it is null', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={5}
          inProgress={false}
          departureLabel={null}
          onPress={() => {}}
        />,
      )

      expect(screen.queryByText('14 juin')).toBeNull()
    })

    it('hides the departure label when in progress even if a label is given', () => {
      render(
        <NextDepartureCard
          trip={makeTrip()}
          days={0}
          inProgress={true}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.queryByText('14 juin')).toBeNull()
    })
  })

  describe('destination', () => {
    it('renders the destination row when a destination is set', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ destination: 'Lisbon' })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText('Lisbon')).toBeOnTheScreen()
    })

    it('omits the destination row when destination is null and falls back to title as the seed', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ destination: null, title: 'Untitled trip' })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      // Title still shows; no separate destination line.
      expect(screen.getByText('Untitled trip')).toBeOnTheScreen()
    })
  })

  describe('members', () => {
    it('renders an avatar stack when the trip has members', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({
            members: [
              makeMember({ id: 'm1', display_name: 'Alice' }),
              makeMember({ id: 'm2', display_name: 'Bob' }),
            ],
          })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      // Initials of the visible members come from their display names.
      expect(screen.getByText('A')).toBeOnTheScreen()
      expect(screen.getByText('B')).toBeOnTheScreen()
    })

    it('renders no member initials when the trip has no members', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ members: [] })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      // Empty members hits the `<View />` placeholder branch: no avatar initial is rendered
      // (the default member "Alice" -> "A" must be absent), while the rest of the card stays.
      expect(screen.queryByText('A')).toBeNull()
      expect(screen.getByText('Summer in Paris')).toBeOnTheScreen()
    })

    it('maps a null member display name to undefined (fallback initial)', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ members: [makeMember({ display_name: null })] })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      // initialOf(undefined) yields '?'.
      expect(screen.getByText('?')).toBeOnTheScreen()
    })
  })

  describe('balance pill', () => {
    it('renders a positive balance', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ myBalanceCents: 1500, currency: 'EUR' })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText(/15/)).toBeOnTheScreen()
    })

    it('renders a negative balance', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ myBalanceCents: -2300, currency: 'EUR' })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      expect(screen.getByText(/23/)).toBeOnTheScreen()
    })

    it('renders a zero balance as an unsigned amount', () => {
      render(
        <NextDepartureCard
          trip={makeTrip({ myBalanceCents: 0, currency: 'USD' })}
          days={5}
          inProgress={false}
          departureLabel="14 juin"
          onPress={() => {}}
        />,
      )

      // signedAmount(0, 'USD') -> "0.00 USD" (no sign prefix for a zero balance).
      expect(screen.getByText('0.00 USD')).toBeOnTheScreen()
    })
  })

  it('renders the photo cover when the trip has a cover photo url', () => {
    render(
      <NextDepartureCard
        trip={makeTrip({ cover_photo_url: 'https://example.com/cover.jpg' })}
        days={5}
        inProgress={false}
        departureLabel="14 juin"
        onPress={() => {}}
      />,
    )

    // A cover URL makes CityImage render the expo-image photo over the gradient fallback.
    expect(renderedHasImage()).toBe(true)
  })

  it('renders the gradient colour fallback (no photo) when there is no cover photo url', () => {
    render(
      <NextDepartureCard
        trip={makeTrip({ cover_photo_url: null })}
        days={5}
        inProgress={false}
        departureLabel="14 juin"
        onPress={() => {}}
      />,
    )

    // Without a cover URL CityImage shows only the deterministic colour cover - no image node.
    expect(renderedHasImage()).toBe(false)
  })
})
