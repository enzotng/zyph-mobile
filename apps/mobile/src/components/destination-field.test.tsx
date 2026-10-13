import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { changeLanguage } from 'i18next'
import { useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { type PlaceResult, usePlaceSearch } from '@/features/places'

import { DestinationField } from './destination-field'

// Control the search hook so loading / results / empty branches are deterministic and no
// network or react-query wiring is needed. The real hook is covered by its own test.
jest.mock('@/features/places', () => ({
  usePlaceSearch: jest.fn(),
}))

const mockUsePlaceSearch = usePlaceSearch as jest.Mock

type SearchState = {
  data?: PlaceResult[]
  isFetching?: boolean
}

function mockSearch({ data, isFetching = false }: SearchState) {
  mockUsePlaceSearch.mockReturnValue({ data, isFetching })
}

const PARIS: PlaceResult = { label: 'Paris, France', lat: 48.8566, lng: 2.3522 }
const ROME: PlaceResult = { label: 'Rome, Italy', lat: 41.9028, lng: 12.4964 }

const PLACEHOLDER = 'Lisbon, Portugal'
const GEO_HINT = 'Pick a suggestion again to locate it.'

// Mirrors both consumer screens (trips/new and trips/[id]/edit): typing keeps the text and drops
// the stored coordinates, picking a suggestion stores its canonical label and coordinates.
function Harness({
  destination = '',
  located = false,
  error,
}: {
  destination?: string
  located?: boolean
  error?: string
}) {
  const [value, setValue] = useState(destination)
  const [hasCoordinates, setHasCoordinates] = useState(located)

  return (
    <DestinationField
      label="Destination"
      value={value}
      hasCoordinates={hasCoordinates}
      error={error}
      onChangeText={(text) => {
        setValue(text)
        setHasCoordinates(false)
      }}
      onSelectPlace={(place) => {
        setValue(place.label)
        setHasCoordinates(true)
      }}
    />
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSearch({ data: undefined, isFetching: false })
})

afterEach(() => {
  changeLanguage('en')
})

describe('DestinationField', () => {
  it('renders the label and the current destination', () => {
    render(<Harness destination="Paris, France" located />)

    expect(screen.getByText('Destination')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('Paris, France')
  })

  it('renders the validation error when provided', () => {
    render(<Harness error="Destination is required" />)

    expect(screen.getByText('Destination is required')).toBeOnTheScreen()
  })

  it('keeps the dropdown closed for queries shorter than 3 characters', () => {
    mockSearch({ data: [PARIS] })
    render(<Harness />)

    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'pa')

    expect(screen.queryByText('Paris, France')).toBeNull()
  })

  it('shows a loading indicator while fetching with no results yet', () => {
    mockSearch({ data: undefined, isFetching: true })
    render(<Harness />)

    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'par')

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    expect(screen.queryByText('No address found.')).toBeNull()
  })

  it('renders the suggestions list once results arrive', () => {
    mockSearch({ data: [PARIS, ROME] })
    render(<Harness />)

    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'par')

    expect(screen.getByText('Paris, France')).toBeOnTheScreen()
    expect(screen.getByText('Rome, Italy')).toBeOnTheScreen()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('renders the empty state when results are an empty array', () => {
    mockSearch({ data: [] })
    render(<Harness />)

    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'xyz')

    expect(screen.getByText('No address found.')).toBeOnTheScreen()
  })

  it('adopts the picked label and closes the dropdown', () => {
    mockSearch({ data: [PARIS, ROME] })
    render(<Harness />)

    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.changeText(input, 'rome')
    fireEvent.press(screen.getByText('Rome, Italy'))

    expect(input.props.value).toBe('Rome, Italy')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('applies the pressed style variant on a suggestion row', () => {
    mockSearch({ data: [PARIS] })
    render(<Harness />)

    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'par')

    const styleFn = screen.UNSAFE_root.findAll(
      (node) => typeof node.props.style === 'function',
    ).map((node) => node.props.style as (state: { pressed: boolean }) => unknown)[0]
    expect(typeof styleFn).toBe('function')
    expect(() => styleFn({ pressed: true })).not.toThrow()
    expect(() => styleFn({ pressed: false })).not.toThrow()
  })

  it('debounces the query before it reaches the search hook', () => {
    jest.useFakeTimers()
    try {
      mockSearch({ data: [PARIS] })
      render(<Harness />)

      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'par')
      mockUsePlaceSearch.mockClear()

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(mockUsePlaceSearch).toHaveBeenLastCalledWith('par', 'en')
    } finally {
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })

  it('requests results in French when the active language is fr', () => {
    changeLanguage('fr')
    render(<Harness />)

    expect(mockUsePlaceSearch).toHaveBeenLastCalledWith(expect.any(String), 'fr')
    expect(screen.getByPlaceholderText('Lisbonne, Portugal')).toBeOnTheScreen()
  })

  describe('geolocation hint', () => {
    it('stays silent while free text is typed with no coordinates to lose', () => {
      render(<Harness />)

      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'somewhere off-grid')

      expect(screen.queryByText(GEO_HINT)).toBeNull()
    })

    it('stays silent on an untouched destination that carries coordinates', () => {
      render(<Harness destination="Paris, France" located />)

      expect(screen.queryByText(GEO_HINT)).toBeNull()
    })

    it('goes quiet again when the located destination is cleared outright', () => {
      render(<Harness destination="Paris, France" located />)

      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Paris')
      expect(screen.getByText(GEO_HINT)).toBeTruthy()

      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '   ')
      expect(screen.queryByText(GEO_HINT)).toBeNull()
    })

    it('warns once a located destination is edited by hand', () => {
      render(<Harness destination="Paris, France" located />)

      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Paris, Texas')

      expect(screen.getByText(GEO_HINT)).toBeOnTheScreen()
    })

    it('keeps warning when the edited text is typed back to the original label', () => {
      render(<Harness destination="Paris, France" located />)

      const input = screen.getByPlaceholderText(PLACEHOLDER)
      fireEvent.changeText(input, 'Paris, Franc')
      fireEvent.changeText(input, 'Paris, France')

      expect(screen.getByText(GEO_HINT)).toBeOnTheScreen()
    })

    it('clears the warning as soon as a suggestion is picked again', () => {
      mockSearch({ data: [ROME] })
      render(<Harness destination="Paris, France" located />)

      const input = screen.getByPlaceholderText(PLACEHOLDER)
      fireEvent.changeText(input, 'rome')
      expect(screen.getByText(GEO_HINT)).toBeOnTheScreen()

      fireEvent.press(screen.getByText('Rome, Italy'))

      expect(screen.queryByText(GEO_HINT)).toBeNull()
    })

    it('warns when a freshly picked destination is then edited (new trip flow)', () => {
      mockSearch({ data: [PARIS] })
      render(<Harness />)

      const input = screen.getByPlaceholderText(PLACEHOLDER)
      fireEvent.changeText(input, 'par')
      fireEvent.press(screen.getByText('Paris, France'))
      expect(screen.queryByText(GEO_HINT)).toBeNull()

      fireEvent.changeText(input, 'Paris 15e')

      expect(screen.getByText(GEO_HINT)).toBeOnTheScreen()
    })

    it('renders the French copy when the active language is fr', () => {
      changeLanguage('fr')
      render(<Harness destination="Paris, France" located />)

      fireEvent.changeText(screen.getByPlaceholderText('Lisbonne, Portugal'), 'Paris 15e')

      expect(screen.getByText('Repasse par une suggestion pour géolocaliser.')).toBeOnTheScreen()
    })
  })
})
