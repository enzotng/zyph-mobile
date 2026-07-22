import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { PoiListView } from './poi-list-view'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('@/features/wayfinder', () => ({
  usePois: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  useDeletePoi: () => ({ mutateAsync: jest.fn() }),
}))
jest.mock('@/features/trips', () => ({ useTrip: () => ({ data: { title: 'Lisbon' } }) }))

describe('PoiListView', () => {
  it('shows the empty state and opens the add form from its CTA', async () => {
    render(<PoiListView tripId="trip-1" />)
    expect(screen.getByText('No waypoints yet')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Add a waypoint'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/trips/[id]/pois/new',
        params: { id: 'trip-1' },
      }),
    )
  })
})
