import { fireEvent, render, screen } from '@testing-library/react-native'

import { useEvents } from '@/features/timeline'
import type { Trip } from '@/features/trips'

import { usePois } from '../hooks/use-pois'
import type { Poi } from '../poi.types'
import { ActivitiesRail } from './activities-rail'

// ActivitiesRail fetches the trip's events (in-plan badges) and POIs (the carousel itself);
// stub both so the rail renders deterministically without a live query client or network.
jest.mock('@/lib/supabase')
jest.mock('@/features/timeline', () => {
  const actual = jest.requireActual('@/features/timeline')
  return { ...actual, useEvents: jest.fn() }
})
jest.mock('../hooks/use-pois', () => ({ usePois: jest.fn() }))
// PoiCard resolves a photo via a query; stub it so no query client is needed (same pattern as
// poi-card.test.tsx).
jest.mock('../hooks/use-poi-photo', () => ({ usePoiPhoto: () => ({ data: null }) }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const useEventsMock = useEvents as jest.Mock
const usePoisMock = usePois as jest.Mock

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    budget_level: null,
    budget_total_cents: null,
    cover_photo_author: null,
    cover_photo_author_url: null,
    cover_photo_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    currency: 'EUR',
    destination: 'Lisbon',
    dietary: [],
    end_date: '2026-06-03',
    id: 't1',
    interests: [],
    invite_code: 'ABC123',
    latitude: 38.7,
    longitude: -9.1,
    owner_id: 'owner1',
    pace: null,
    start_date: '2026-06-01',
    title: 'Lisbon weekend',
    trip_type: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    placeId: 'place-1',
    name: 'Belem Tower',
    lat: 38.69,
    lng: -9.21,
    rating: 4.6,
    ratingCount: 5000,
    priceLevel: null,
    types: ['tourist_attraction'],
    photoName: null,
    address: null,
    openNow: null,
    description: null,
    typeLabel: null,
    priceStart: null,
    priceEnd: null,
    priceCurrency: null,
    weekdayHours: null,
    ...overrides,
  }
}

describe('ActivitiesRail', () => {
  beforeEach(() => {
    mockPush.mockClear()
    useEventsMock.mockReturnValue({ data: [] })
    usePoisMock.mockReturnValue({ data: [makePoi()], isLoading: false, isError: false })
  })

  it('renders nothing when the trip has no coordinates', () => {
    const { toJSON } = render(<ActivitiesRail trip={makeTrip({ latitude: null })} />)

    expect(toJSON()).toBeNull()
  })

  it('renders nothing while the POI search is loading', () => {
    usePoisMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    const { toJSON } = render(<ActivitiesRail trip={makeTrip()} />)

    expect(toJSON()).toBeNull()
  })

  it('renders nothing when the POI search errors', () => {
    usePoisMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    const { toJSON } = render(<ActivitiesRail trip={makeTrip()} />)

    expect(toJSON()).toBeNull()
  })

  it('renders nothing when the POI search comes back empty', () => {
    usePoisMock.mockReturnValue({ data: [], isLoading: false, isError: false })

    const { toJSON } = render(<ActivitiesRail trip={makeTrip()} />)

    expect(toJSON()).toBeNull()
  })

  it('renders the destination-based title and the POI cards', () => {
    render(<ActivitiesRail trip={makeTrip({ destination: 'Lisbon' })} />)

    expect(screen.getByText('Things to do in Lisbon')).toBeOnTheScreen()
    expect(screen.getByText('Belem Tower')).toBeOnTheScreen()
  })

  it('falls back to the generic title when the trip has no destination', () => {
    render(<ActivitiesRail trip={makeTrip({ destination: null })} />)

    expect(screen.getByText('Things to do')).toBeOnTheScreen()
  })

  it('flags a POI already on the trip as "in your plan"', () => {
    useEventsMock.mockReturnValue({ data: [{ place_id: 'place-1' }, { place_id: null }] })

    render(<ActivitiesRail trip={makeTrip()} />)

    expect(screen.getByText('In your plan')).toBeOnTheScreen()
  })

  it('does not flag a POI absent from the trip plan', () => {
    useEventsMock.mockReturnValue({ data: [{ place_id: 'some-other-place' }] })

    render(<ActivitiesRail trip={makeTrip()} />)

    expect(screen.queryByText('In your plan')).toBeNull()
  })

  it('navigates to the activities screen (no focus) on "See all"', () => {
    render(<ActivitiesRail trip={makeTrip()} />)

    fireEvent.press(screen.getByRole('button', { name: 'See all' }))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/trips/[id]/activities',
      params: { id: 't1' },
    })
  })

  it('navigates to the activities screen with a focus param on a card tap', () => {
    render(<ActivitiesRail trip={makeTrip()} />)

    fireEvent.press(screen.getByLabelText('Belem Tower'))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/trips/[id]/activities',
      params: { id: 't1', focus: 'place-1' },
    })
  })
})
