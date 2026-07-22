import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'

import { TripMapCanvas, type TripMapCanvasHandle } from './trip-map-canvas'

type MarkerClickEvent = { id?: string }
type MapClickEvent = { coordinates: { latitude?: number; longitude?: number } }
type AppleMapProps = {
  onMarkerClick?: (marker: MarkerClickEvent) => void
  onMapClick?: (event: MapClickEvent) => void
}

// Shared holder for the latest AppleMaps.View props, following the LocationPicker precedent
// (src/components/location-picker.test.tsx): capture the props so the test can drive
// onMarkerClick/onMapClick directly, the only way to reach the canvas-internal disarm paths
// (handleMarkerClick, handleMapClick) that the imperative handle doesn't exercise.
const mockMapState: { props: AppleMapProps | null } = { props: null }

jest.mock('expo-maps', () => {
  const React = require('react')
  const { Pressable: RNPressable } = require('react-native')
  function View(props: AppleMapProps) {
    mockMapState.props = props
    return React.createElement(RNPressable, { testID: 'apple-map' })
  }
  return {
    __esModule: true,
    AppleMaps: {
      View,
      MapType: { IMAGERY: 'IMAGERY', STANDARD: 'STANDARD' },
      MapColorScheme: { DARK: 'DARK', LIGHT: 'LIGHT' },
    },
  }
})

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('../hooks/use-wayfinder-targets', () => ({
  useWayfinderTargets: () => ({ targets: [] }),
}))

// Selecting a marker enables the distance-readout GPS watcher (useUserLocation(selectedId !==
// null, ...)); stub it so the marker-click test doesn't hit the real expo-location permission
// flow, which is unrelated to what's under test here.
jest.mock('@/lib/sensors', () => ({
  useUserLocation: () => ({ location: null, error: null, status: 'idle' }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockMapState.props = null
})

describe('TripMapCanvas', () => {
  it('reports add mode arming and cancelling through onAddModeChange', () => {
    const onAddModeChange = jest.fn()
    const ref = createRef<TripMapCanvasHandle>()
    render(
      <TripMapCanvas ref={ref} tripId="trip-1" topInset={0} onAddModeChange={onAddModeChange} />,
    )

    act(() => ref.current?.startAddPlace())
    expect(onAddModeChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('Tap the map to drop a place')).toBeOnTheScreen()

    act(() => ref.current?.cancelAddPlace())
    expect(onAddModeChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByText('Tap the map to drop a place')).not.toBeOnTheScreen()
  })

  it('opens the layers sheet from the handle', () => {
    const ref = createRef<TripMapCanvasHandle>()
    render(<TripMapCanvas ref={ref} tripId="trip-1" topInset={0} />)

    expect(screen.queryByText('Appearance')).not.toBeOnTheScreen()
    act(() => ref.current?.openLayers())
    expect(screen.getByText('Appearance')).toBeOnTheScreen()
  })

  it('disarms add mode when a marker is tapped, not just through the imperative handle', () => {
    const onAddModeChange = jest.fn()
    const ref = createRef<TripMapCanvasHandle>()
    render(
      <TripMapCanvas ref={ref} tripId="trip-1" topInset={0} onAddModeChange={onAddModeChange} />,
    )

    act(() => ref.current?.startAddPlace())
    expect(onAddModeChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('Tap the map to drop a place')).toBeOnTheScreen()

    act(() => mockMapState.props?.onMarkerClick?.({ id: 'poi:p1' }))

    expect(onAddModeChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByText('Tap the map to drop a place')).not.toBeOnTheScreen()
  })

  it('disarms add mode and pushes the new-POI form when the map is tapped to drop the pin', () => {
    const onAddModeChange = jest.fn()
    const ref = createRef<TripMapCanvasHandle>()
    render(
      <TripMapCanvas ref={ref} tripId="trip-1" topInset={0} onAddModeChange={onAddModeChange} />,
    )

    act(() => ref.current?.startAddPlace())
    expect(onAddModeChange).toHaveBeenLastCalledWith(true)

    act(() =>
      mockMapState.props?.onMapClick?.({ coordinates: { latitude: 48.8566, longitude: 2.3522 } }),
    )

    expect(onAddModeChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByText('Tap the map to drop a place')).not.toBeOnTheScreen()
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/trips/[id]/pois/new',
      params: { id: 'trip-1', lat: '48.8566', lng: '2.3522' },
    })
  })
})
