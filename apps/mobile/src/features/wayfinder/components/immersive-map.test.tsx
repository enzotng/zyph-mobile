import { fireEvent, render, screen } from '@testing-library/react-native'

import { ImmersiveMap } from './immersive-map'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

jest.mock('../hooks/use-wayfinder', () => ({
  usePois: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  useMemberLocations: () => ({ data: [] }),
}))
jest.mock('@/features/places', () => ({ usePlaceSearch: () => ({ data: [], isFetching: false }) }))
jest.mock('@/lib/sensors', () => ({
  useUserLocation: () => ({ location: null, error: null, status: 'idle' }),
}))

const mockFocusTarget = jest.fn()
const mockStartAddPlace = jest.fn()
const mockCancelAddPlace = jest.fn()
const mockOpenLayers = jest.fn()
const mockRecenter = jest.fn()

// Stub the canvas: expose the handle and let the test drive onAddModeChange.
jest.mock('./trip-map-canvas', () => {
  const { forwardRef, useImperativeHandle } = require('react')
  return {
    TripMapCanvas: forwardRef(function TripMapCanvas(
      props: { onAddModeChange?: (a: boolean) => void },
      ref: unknown,
    ) {
      useImperativeHandle(ref, () => ({
        focusTarget: mockFocusTarget,
        recenter: mockRecenter,
        openLayers: mockOpenLayers,
        startAddPlace: () => {
          mockStartAddPlace()
          props.onAddModeChange?.(true)
        },
        cancelAddPlace: () => {
          mockCancelAddPlace()
          props.onAddModeChange?.(false)
        },
      }))
      return null
    }),
  }
})

describe('ImmersiveMap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Cleared above, so restore the default: the map was pushed from a tab and can pop back.
    mockCanGoBack.mockReturnValue(true)
  })

  it('focuses the target it was opened with, once', () => {
    render(<ImmersiveMap tripId="trip-1" focusId="poi:poi-1" />)
    expect(mockFocusTarget).toHaveBeenCalledWith('poi:poi-1')
    expect(mockFocusTarget).toHaveBeenCalledTimes(1)
  })

  it('opens AR with no target', () => {
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)
    fireEvent.press(screen.getByLabelText('Open AR view'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/trips/[id]/ar', params: { id: 'trip-1' } })
  })

  it('opens the layers sheet', () => {
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)
    fireEvent.press(screen.getByLabelText('Layers'))
    expect(mockOpenLayers).toHaveBeenCalledTimes(1)
  })

  it('arms add-place mode and lets the user cancel it', () => {
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)
    fireEvent.press(screen.getByText('Add a waypoint'))
    expect(mockStartAddPlace).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('Cancel'))
    expect(mockCancelAddPlace).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Cancel')).not.toBeOnTheScreen()
  })

  it('hides the control stack while add-place mode is armed, and restores it on cancel', () => {
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)
    expect(screen.getByLabelText('Layers')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Add a waypoint'))
    expect(screen.queryByLabelText('Layers')).not.toBeOnTheScreen()
    expect(screen.queryByLabelText('Open AR view')).not.toBeOnTheScreen()

    fireEvent.press(screen.getByText('Cancel'))
    expect(screen.getByLabelText('Layers')).toBeOnTheScreen()
  })

  it('pops back to the tab that opened it', () => {
    mockCanGoBack.mockReturnValue(true)
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)

    fireEvent.press(screen.getByLabelText('Back'))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('falls back to the trip home when there is nothing to pop (deep link straight to the map)', () => {
    mockCanGoBack.mockReturnValue(false)
    render(<ImmersiveMap tripId="trip-1" focusId={null} />)

    fireEvent.press(screen.getByLabelText('Back'))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/trips/[id]',
      params: { id: 'trip-1' },
    })
  })
})
