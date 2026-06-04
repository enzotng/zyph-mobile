import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, Platform } from 'react-native'

import { type Coords, LocationPicker } from './location-picker'

type MapClickEvent = { coordinates: { latitude?: number; longitude?: number } }
type AppleMapProps = {
  onMapClick?: (event: MapClickEvent) => void
  cameraPosition?: unknown
  markers?: unknown
}

// Shared holder for the latest AppleMaps.View props. The `mock` prefix lets the
// jest.mock factory (which is hoisted) reference it.
const mockMapState: { props: AppleMapProps | null } = { props: null }

// expo-maps: native module absent in unit tests. Capture the AppleMaps.View props so the
// test can drive onMapClick, and render a pressable stub.
jest.mock('expo-maps', () => {
  const React = require('react')
  const { Pressable: RNPressable } = require('react-native')
  function View(props: AppleMapProps) {
    mockMapState.props = props
    return React.createElement(RNPressable, { testID: 'apple-map' })
  }
  return { __esModule: true, AppleMaps: { View } }
})

// expo-location: native permission + GPS calls are mocked so we can drive every branch.
jest.mock('expo-location', () => ({
  __esModule: true,
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}))

// AddressSearchField pulls in react-query/i18n; stub it to a button exposing onSelect so the
// LocationPicker branches stay isolated.
jest.mock('@/components/address-search-field', () => {
  const React = require('react')
  const { Pressable: RNPressable, Text: RNText } = require('react-native')
  return {
    __esModule: true,
    AddressSearchField: ({
      onSelect,
    }: {
      onSelect: (place: { lat: number; lng: number; label: string }) => void
    }) =>
      React.createElement(
        RNPressable,
        { testID: 'address-search', onPress: () => onSelect({ lat: 10, lng: 20, label: 'Paris' }) },
        React.createElement(RNText, null, 'search'),
      ),
  }
})

type LocationMock = {
  requestForegroundPermissionsAsync: jest.Mock
  getCurrentPositionAsync: jest.Mock
}

function locationMock(): LocationMock {
  return jest.requireMock('expo-location') as LocationMock
}

function mapsState(): { props: AppleMapProps | null } {
  return mockMapState
}

const COORDS: Coords = { lat: 48.8566, lng: 2.3522 }

describe('LocationPicker - iOS', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true })
    mapsState().props = null
  })

  it('renders the label when provided', () => {
    render(<LocationPicker label="Where" value={null} onChange={jest.fn()} />)

    expect(screen.getByText('Where')).toBeOnTheScreen()
  })

  it('does not render a label node when label is omitted', () => {
    render(<LocationPicker value={null} onChange={jest.fn()} />)

    expect(screen.queryByText('Where')).toBeNull()
  })

  it('shows the drop-a-pin hint when there is no value', () => {
    render(<LocationPicker value={null} onChange={jest.fn()} />)

    expect(screen.getByText('Tap the map to drop a pin.')).toBeOnTheScreen()
  })

  it('shows the adjust-pin hint when a value is set', () => {
    render(<LocationPicker value={COORDS} onChange={jest.fn()} />)

    expect(screen.getByText('Tap the map to adjust the pin.')).toBeOnTheScreen()
  })

  it('renders the camera position and a marker when a value is set', () => {
    render(<LocationPicker value={COORDS} onChange={jest.fn()} />)

    expect(mapsState().props?.cameraPosition).toEqual({
      coordinates: { latitude: COORDS.lat, longitude: COORDS.lng },
      zoom: 13,
    })
    expect(mapsState().props?.markers).toEqual([
      { coordinates: { latitude: COORDS.lat, longitude: COORDS.lng }, title: 'Event' },
    ])
  })

  it('passes an undefined camera and empty markers when value is null', () => {
    render(<LocationPicker value={null} onChange={jest.fn()} />)

    expect(mapsState().props?.cameraPosition).toBeUndefined()
    expect(mapsState().props?.markers).toEqual([])
  })

  it('calls onChange when the address search selects a place', () => {
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByTestId('address-search'))

    expect(onChange).toHaveBeenCalledWith({ lat: 10, lng: 20 })
  })

  it('calls onChange when the map is clicked with valid coordinates', () => {
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    act(() => {
      mapsState().props?.onMapClick?.({ coordinates: { latitude: 1.5, longitude: 2.5 } })
    })

    expect(onChange).toHaveBeenCalledWith({ lat: 1.5, lng: 2.5 })
  })

  it('ignores a map click with missing coordinates', () => {
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    act(() => {
      mapsState().props?.onMapClick?.({ coordinates: { latitude: undefined, longitude: 2.5 } })
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders the "use my location" link when idle', () => {
    render(<LocationPicker value={null} onChange={jest.fn()} />)

    expect(screen.getByText('Use my location')).toBeOnTheScreen()
  })

  it('calls onChange with the current position when permission is granted', async () => {
    locationMock().requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
    locationMock().getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 51.5, longitude: -0.12 },
    })
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ lat: 51.5, lng: -0.12 })
    })
  })

  it('alerts and does not call onChange when permission is denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    locationMock().requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' })
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Location off',
        'Allow location access to use your current position.',
      )
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(locationMock().getCurrentPositionAsync).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('alerts on a location error and does not call onChange', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    locationMock().requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
    locationMock().getCurrentPositionAsync.mockRejectedValue(new Error('gps down'))
    const onChange = jest.fn()
    render(<LocationPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Location error',
        'Could not get your current position.',
      )
    })
    expect(onChange).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('shows a spinner while locating, then restores the link afterwards', async () => {
    let resolvePermission: (value: { status: string }) => void = () => undefined
    locationMock().requestForegroundPermissionsAsync.mockReturnValue(
      new Promise<{ status: string }>((resolve) => {
        resolvePermission = resolve
      }),
    )
    locationMock().getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 1, longitude: 2 },
    })
    render(<LocationPicker value={null} onChange={jest.fn()} />)

    fireEvent.press(screen.getByRole('button'))

    // Locating: the link text is replaced by the ActivityIndicator.
    await waitFor(() => {
      expect(screen.queryByText('Use my location')).toBeNull()
    })

    await act(async () => {
      resolvePermission({ status: 'granted' })
    })

    // Finally block flips locating back off, restoring the link.
    await waitFor(() => {
      expect(screen.getByText('Use my location')).toBeOnTheScreen()
    })
  })
})

describe('LocationPicker - non-iOS', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })
  })

  it('renders nothing on Android', () => {
    render(<LocationPicker label="Where" value={COORDS} onChange={jest.fn()} />)

    expect(screen.queryByText('Where')).toBeNull()
    expect(screen.queryByTestId('apple-map')).toBeNull()
    expect(screen.queryByText('Use my location')).toBeNull()
  })
})
