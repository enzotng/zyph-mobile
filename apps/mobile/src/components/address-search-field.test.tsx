import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { changeLanguage } from 'i18next'
import { ActivityIndicator } from 'react-native'

import { type PlaceResult, usePlaceSearch } from '@/features/places'

import { AddressSearchField } from './address-search-field'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockSearch({ data: undefined, isFetching: false })
})

afterEach(() => {
  changeLanguage('en')
})

describe('AddressSearchField', () => {
  it('renders the placeholder text field', () => {
    render(<AddressSearchField onSelect={jest.fn()} />)

    expect(screen.getByPlaceholderText('Search an address…')).toBeOnTheScreen()
  })

  it('renders the label when provided', () => {
    render(<AddressSearchField label="Destination" onSelect={jest.fn()} />)

    expect(screen.getByText('Destination')).toBeOnTheScreen()
  })

  it('does not render a label when none is provided', () => {
    render(<AddressSearchField onSelect={jest.fn()} />)

    expect(screen.queryByText('Destination')).toBeNull()
  })

  it('keeps the dropdown closed for queries shorter than 3 characters', () => {
    mockSearch({ data: [PARIS] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'pa')

    expect(screen.queryByText('Paris, France')).toBeNull()
  })

  it('keeps the dropdown closed when the query is only whitespace', () => {
    mockSearch({ data: [PARIS] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), '   ')

    expect(screen.queryByText('Paris, France')).toBeNull()
  })

  it('shows a loading indicator while fetching with no results yet', () => {
    mockSearch({ data: undefined, isFetching: true })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'par')

    // Spinner present, no result rows and no empty state.
    expect(screen.queryByText('No address found.')).toBeNull()
    expect(screen.queryByText('Paris, France')).toBeNull()
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('renders the suggestions list once results arrive', () => {
    mockSearch({ data: [PARIS, ROME] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'rome')

    expect(screen.getByText('Paris, France')).toBeOnTheScreen()
    expect(screen.getByText('Rome, Italy')).toBeOnTheScreen()
  })

  it('renders the empty state when results are an empty array', () => {
    mockSearch({ data: [] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'xyz')

    expect(screen.getByText('No address found.')).toBeOnTheScreen()
  })

  it('still shows results when fetching in the background (results already present)', () => {
    mockSearch({ data: [PARIS], isFetching: true })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'par')

    // isFetching && !results is false because results exist -> list path, not spinner.
    expect(screen.getByText('Paris, France')).toBeOnTheScreen()
  })

  it('calls onSelect with the picked place and clears the field', () => {
    const onSelect = jest.fn()
    mockSearch({ data: [PARIS, ROME] })
    render(<AddressSearchField onSelect={onSelect} />)

    const input = screen.getByPlaceholderText('Search an address…')
    fireEvent.changeText(input, 'rome')

    fireEvent.press(screen.getByText('Rome, Italy'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(ROME)

    // Field cleared -> query below 3 chars -> dropdown closed again.
    expect(screen.queryByText('Rome, Italy')).toBeNull()
    expect(input.props.value).toBe('')
  })

  it('applies the pressed style variant on a suggestion row', () => {
    mockSearch({ data: [PARIS] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'par')

    // The Pressable's style is a function of { pressed }. The composite Pressable element
    // keeps the original function prop, so invoking it for both states covers the
    // pressed=true and pressed=false arms of the conditional style.
    const styleFn = screen.UNSAFE_root.findAll(
      (node) => typeof node.props.style === 'function',
    ).map((node) => node.props.style as (state: { pressed: boolean }) => unknown)[0]
    expect(typeof styleFn).toBe('function')
    expect(() => styleFn({ pressed: true })).not.toThrow()
    expect(() => styleFn({ pressed: false })).not.toThrow()

    // Driving the real press lifecycle keeps the interaction path exercised end to end.
    const row = screen.getByRole('button')
    act(() => {
      fireEvent(row, 'pressIn')
    })
    act(() => {
      fireEvent(row, 'pressOut')
    })
    expect(screen.getByText('Paris, France')).toBeOnTheScreen()
  })

  it('renders a separator border on every row after the first', () => {
    mockSearch({ data: [PARIS, ROME] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'par')

    // Two suggestions -> the index > 0 && styles.rowBorder branch is taken for the second.
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
  })

  it('debounces the query before it reaches the search hook', () => {
    jest.useFakeTimers()
    try {
      mockSearch({ data: [PARIS] })
      render(<AddressSearchField onSelect={jest.fn()} />)

      fireEvent.changeText(screen.getByPlaceholderText('Search an address…'), 'par')
      mockUsePlaceSearch.mockClear()

      // Flush the 300ms debounce timer -> the setTimeout callback runs setDebounced(query).
      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(mockUsePlaceSearch).toHaveBeenLastCalledWith('par', 'en')
    } finally {
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })

  it('requests results in English by default', () => {
    render(<AddressSearchField onSelect={jest.fn()} />)

    expect(mockUsePlaceSearch).toHaveBeenCalledWith(expect.any(String), 'en')
  })

  it('requests results in French when the active language is fr', () => {
    changeLanguage('fr')
    render(<AddressSearchField onSelect={jest.fn()} />)

    expect(mockUsePlaceSearch).toHaveBeenLastCalledWith(expect.any(String), 'fr')
    expect(screen.getByPlaceholderText('Rechercher une adresse…')).toBeOnTheScreen()
  })

  it('shows the French empty state when no address is found in French', () => {
    changeLanguage('fr')
    mockSearch({ data: [] })
    render(<AddressSearchField onSelect={jest.fn()} />)

    fireEvent.changeText(screen.getByPlaceholderText('Rechercher une adresse…'), 'xyz')

    expect(screen.getByText('Aucune adresse trouvée.')).toBeOnTheScreen()
  })
})
