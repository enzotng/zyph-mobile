import { fireEvent, render, screen } from '@testing-library/react-native'

import type { MemberLocationWithMember, TripPoi } from '@/features/wayfinder'

import { NearbySheet, type NearbySheetProps } from './nearby-sheet'

function makePoi(overrides: Partial<TripPoi> = {}): TripPoi {
  return {
    id: 'poi-1',
    trip_id: 'trip-1',
    label: 'Blue Bottle',
    lat: 48.8566,
    lng: 2.3522,
    icon: 'star',
    created_at: '2026-07-01T10:00:00Z',
    created_by: 'user-1',
    ...overrides,
  } as TripPoi
}

function setup(overrides: Partial<NearbySheetProps> = {}) {
  const props: NearbySheetProps = {
    places: [makePoi()],
    people: [],
    userLoc: null,
    isLoading: false,
    isError: false,
    onRetry: jest.fn(),
    onRoutePlace: jest.fn(),
    onOpenPlace: jest.fn(),
    onFocusPerson: jest.fn(),
    onAddPlace: jest.fn(),
    snap: 'mid',
    onSnapChange: jest.fn(),
    ...overrides,
  }
  render(<NearbySheet {...props} />)
  return props
}

describe('NearbySheet', () => {
  it('lists the trip places', () => {
    setup()
    expect(screen.getByText('Blue Bottle')).toBeOnTheScreen()
  })

  it('opens a place when its row is tapped', () => {
    const props = setup()
    fireEvent.press(screen.getByLabelText('Blue Bottle'))
    expect(props.onOpenPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 'poi-1' }))
  })

  it('shows skeletons while loading and no rows', () => {
    setup({ isLoading: true, places: [] })
    expect(screen.getByLabelText('Nearby')).toBeOnTheScreen()
    expect(screen.getByRole('progressbar')).toBeOnTheScreen()
    expect(screen.queryByText('No places yet. Tap add to drop one.')).not.toBeOnTheScreen()
  })

  it('offers a retry when the query failed', () => {
    const props = setup({ isError: true, places: [] })
    fireEvent.press(screen.getByText('Try again'))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers to add a place when the list is empty', () => {
    const props = setup({ places: [] })
    expect(screen.getByText('No places yet. Tap add to drop one.')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Add a waypoint'))
    expect(props.onAddPlace).toHaveBeenCalledTimes(1)
  })

  it('switches to the People segment', () => {
    const person = {
      trip_member_id: 'tm-1',
      lat: 48.85,
      lng: 2.35,
      trip_member: { id: 'tm-1', profile: { display_name: 'Ada', avatar_url: null } },
    } as unknown as MemberLocationWithMember
    setup({ people: [person] })
    fireEvent.press(screen.getByLabelText('People'))
    expect(screen.getByText('Ada')).toBeOnTheScreen()
  })

  it('advances one snap when the header is tapped', () => {
    const props = setup({ snap: 'docked' })
    fireEvent.press(screen.getByLabelText('Nearby'))
    expect(props.onSnapChange).toHaveBeenCalledWith('mid')
  })
})
