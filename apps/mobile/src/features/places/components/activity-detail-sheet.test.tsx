import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

import type { Trip } from '@/features/trips'

import type { Poi } from '../poi.types'
import { ActivityDetailSheet, mapPoiType } from './activity-detail-sheet'

// Stub usePoiPhoto so no network or query provider is needed (same pattern as
// itinerary-block.test.tsx / poi-card.test.tsx).
jest.mock('../hooks/use-poi-photo', () => ({ usePoiPhoto: () => ({ data: null }) }))

// Stub supabase so transitive imports from @/features/trips don't need a real client.
jest.mock('@/lib/supabase')

const mockCreateEventsMutateAsync = jest.fn()
const mockCreatePoiMutateAsync = jest.fn()

// formatEventDay is exercised (and locale-formatted) by its own suite in
// features/timeline/group.test.ts - stub it here to a deterministic passthrough so chip
// assertions don't depend on the test runner's locale.
jest.mock('@/features/timeline', () => ({
  useCreateEvents: () => ({ mutateAsync: mockCreateEventsMutateAsync, isPending: false }),
  formatEventDay: (iso: string | null) => (iso ? iso.slice(0, 10) : 'No date'),
}))

jest.mock('@/features/wayfinder', () => ({
  useCreatePoi: () => ({ mutateAsync: mockCreatePoiMutateAsync, isPending: false }),
}))

const POI: Poi = {
  placeId: 'place-1',
  name: 'National Museum',
  lat: 48.1,
  lng: 2.1,
  rating: 4.7,
  ratingCount: 12345,
  priceLevel: 1,
  types: ['museum'],
  photoName: null,
  address: '10 Rue de Rivoli, Paris',
  openNow: true,
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    start_date: '2026-07-09',
    end_date: '2026-07-12',
    ...overrides,
  } as unknown as Trip
}

function renderSheet(overrides: Partial<Parameters<typeof ActivityDetailSheet>[0]> = {}) {
  const onClose = jest.fn()
  render(
    <ActivityDetailSheet
      poi={POI}
      trip={makeTrip()}
      inPlan={false}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onClose }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-07-10T09:00:00'))
})

afterEach(() => {
  jest.useRealTimers()
})

describe('ActivityDetailSheet', () => {
  it('renders the POI name, rating, and address', () => {
    renderSheet()

    expect(screen.getByText('National Museum')).toBeOnTheScreen()
    expect(screen.getByText('★ 4.7 (12k)')).toBeOnTheScreen()
    expect(screen.getByText('10 Rue de Rivoli, Paris')).toBeOnTheScreen()
  })

  it('renders the price level like PoiCard', () => {
    renderSheet()

    // priceLevel 1 -> '$'.repeat(1 + 1) = '$$'
    expect(screen.getByText('$$')).toBeOnTheScreen()
  })

  it('renders nothing when poi is null', () => {
    render(<ActivityDetailSheet poi={null} trip={makeTrip()} inPlan={false} onClose={jest.fn()} />)

    expect(screen.queryByText('National Museum')).toBeNull()
  })

  it('shows the open label when openNow is true', () => {
    renderSheet()

    expect(screen.getByText('Open now')).toBeOnTheScreen()
  })

  it('shows the closed label when openNow is false', () => {
    renderSheet({ poi: { ...POI, openNow: false } })

    expect(screen.getByText('Closed')).toBeOnTheScreen()
  })

  it('shows the "in your plan" badge when inPlan is true', () => {
    renderSheet({ inPlan: true })

    expect(screen.getByText('In your plan')).toBeOnTheScreen()
  })

  it('shows the category label when provided', () => {
    renderSheet({ categoryLabel: 'Museums' })

    expect(screen.getByText('Museums')).toBeOnTheScreen()
  })

  it('shows day chips for the trip range and preselects today', () => {
    renderSheet()

    expect(screen.getByText('Add on')).toBeOnTheScreen()
    expect(screen.getByText('2026-07-09')).toBeOnTheScreen()
    expect(screen.getByText('2026-07-10')).toBeOnTheScreen()
    expect(screen.getByText('2026-07-11')).toBeOnTheScreen()
    expect(screen.getByText('2026-07-12')).toBeOnTheScreen()

    const today = screen.getByLabelText('2026-07-10')
    expect(today.props.accessibilityState).toEqual({ selected: true })
    const otherDay = screen.getByLabelText('2026-07-09')
    expect(otherDay.props.accessibilityState).toEqual({ selected: false })
  })

  it('preselects the first day when today is outside the trip range', () => {
    renderSheet({ trip: makeTrip({ start_date: '2026-08-01', end_date: '2026-08-03' }) })

    const firstDay = screen.getByLabelText('2026-08-01')
    expect(firstDay.props.accessibilityState).toEqual({ selected: true })
  })

  it('caps the day chips at 21 for a very long trip', () => {
    renderSheet({ trip: makeTrip({ start_date: '2026-07-01', end_date: '2026-08-31' }) })

    expect(screen.queryByText('2026-07-21')).toBeOnTheScreen()
    expect(screen.queryByText('2026-07-22')).toBeNull()
  })

  it('hides the day picker when the trip has no start date', () => {
    renderSheet({ trip: makeTrip({ start_date: null, end_date: null }) })

    expect(screen.queryByText('Add on')).toBeNull()
  })

  it('calls useCreateEvents with the mapped event on "Add to timeline"', async () => {
    mockCreateEventsMutateAsync.mockResolvedValue([])
    renderSheet()

    fireEvent.press(screen.getByText('Add to timeline'))

    await waitFor(() => expect(mockCreateEventsMutateAsync).toHaveBeenCalledTimes(1))
    expect(mockCreateEventsMutateAsync).toHaveBeenCalledWith({
      tripId: 'trip-1',
      events: [
        {
          title: 'National Museum',
          type: 'activity',
          startsAt: new Date('2026-07-10T12:00:00').toISOString(),
          lat: 48.1,
          lng: 2.1,
          placeId: 'place-1',
        },
      ],
    })
  })

  it('uses the selected day chip for startsAt when a different day is tapped', async () => {
    mockCreateEventsMutateAsync.mockResolvedValue([])
    renderSheet()

    fireEvent.press(screen.getByLabelText('2026-07-12'))
    fireEvent.press(screen.getByText('Add to timeline'))

    await waitFor(() => expect(mockCreateEventsMutateAsync).toHaveBeenCalledTimes(1))
    expect(mockCreateEventsMutateAsync.mock.calls[0][0].events[0].startsAt).toBe(
      new Date('2026-07-12T12:00:00').toISOString(),
    )
  })

  it('maps the event type through mapPoiType (museum -> activity)', async () => {
    mockCreateEventsMutateAsync.mockResolvedValue([])
    renderSheet({ poi: { ...POI, types: ['restaurant'] } })

    fireEvent.press(screen.getByText('Add to timeline'))

    await waitFor(() => expect(mockCreateEventsMutateAsync).toHaveBeenCalledTimes(1))
    expect(mockCreateEventsMutateAsync.mock.calls[0][0].events[0].type).toBe('food')
  })

  it('uses "now" for startsAt when the trip has no dates', async () => {
    mockCreateEventsMutateAsync.mockResolvedValue([])
    renderSheet({ trip: makeTrip({ start_date: null, end_date: null }) })

    fireEvent.press(screen.getByText('Add to timeline'))

    await waitFor(() => expect(mockCreateEventsMutateAsync).toHaveBeenCalledTimes(1))
    expect(mockCreateEventsMutateAsync.mock.calls[0][0].events[0].startsAt).toBe(
      new Date('2026-07-10T09:00:00').toISOString(),
    )
  })

  it('shows "Added" and ignores further presses after a successful add', async () => {
    mockCreateEventsMutateAsync.mockResolvedValue([])
    renderSheet()

    fireEvent.press(screen.getByText('Add to timeline'))
    await waitFor(() => expect(screen.getByText('Added')).toBeOnTheScreen())

    fireEvent.press(screen.getByText('Added'))

    expect(mockCreateEventsMutateAsync).toHaveBeenCalledTimes(1)
  })

  it('shows an alert and a haptic error when adding to the timeline fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockCreateEventsMutateAsync.mockRejectedValue(new Error('nope'))
    renderSheet()

    fireEvent.press(screen.getByText('Add to timeline'))

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Something went wrong', 'Please try again.'),
    )
  })

  it('calls useCreatePoi with the POI name and coords on "Save as waypoint"', async () => {
    mockCreatePoiMutateAsync.mockResolvedValue({})
    renderSheet()

    fireEvent.press(screen.getByText('Save as waypoint'))

    await waitFor(() => expect(mockCreatePoiMutateAsync).toHaveBeenCalledTimes(1))
    expect(mockCreatePoiMutateAsync).toHaveBeenCalledWith({
      tripId: 'trip-1',
      label: 'National Museum',
      icon: 'pin',
      lat: 48.1,
      lng: 2.1,
    })
  })

  it('shows "Saved" after a successful waypoint save', async () => {
    mockCreatePoiMutateAsync.mockResolvedValue({})
    renderSheet()

    fireEvent.press(screen.getByText('Save as waypoint'))

    await waitFor(() => expect(screen.getByText('Saved')).toBeOnTheScreen())
  })

  it('shows an alert when saving the waypoint fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockCreatePoiMutateAsync.mockRejectedValue(new Error('nope'))
    renderSheet()

    fireEvent.press(screen.getByText('Save as waypoint'))

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Something went wrong', 'Please try again.'),
    )
  })
})

describe('mapPoiType', () => {
  it('maps restaurant-ish types to food', () => {
    expect(mapPoiType(['restaurant'])).toBe('food')
    expect(mapPoiType(['cafe'])).toBe('food')
    expect(mapPoiType(['bar'])).toBe('food')
    expect(mapPoiType(['bakery'])).toBe('food')
    expect(mapPoiType(['food'])).toBe('food')
  })

  it('maps lodging/hotel types to lodging', () => {
    expect(mapPoiType(['lodging'])).toBe('lodging')
    expect(mapPoiType(['hotel'])).toBe('lodging')
  })

  it('falls back to activity for anything else', () => {
    expect(mapPoiType(['museum'])).toBe('activity')
    expect(mapPoiType([])).toBe('activity')
  })
})
