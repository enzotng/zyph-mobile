import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

import NewTripScreen from './new'

const mockCreateTrip = jest.fn()
const mockAddGhostMembers = jest.fn()
const mockReplace = jest.fn()

jest.mock('@/lib/supabase')

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('@/features/fx', () => ({ useFxRates: () => ({ data: { rates: { USD: 1.1 } } }) }))

jest.mock('@/features/places', () => ({
  usePlaceSearch: () => ({
    data: [{ label: 'Lisbon, Portugal', lat: 38.72, lng: -9.13 }],
    isFetching: false,
  }),
}))

jest.mock('@/features/trips', () => ({
  ...jest.requireActual('@/features/trips'),
  useCreateTrip: () => ({ mutateAsync: mockCreateTrip, isPending: false }),
}))

jest.mock('@/features/group', () => ({
  ...jest.requireActual('@/features/group'),
  useAddGhostMembers: () => ({ mutateAsync: mockAddGhostMembers, isPending: false }),
}))

const TITLE_PLACEHOLDER = 'Weekend in Lisbon'

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateTrip.mockResolvedValue({ id: 't1' })
  // The hook resolves with the names it could not add; none by default.
  mockAddGhostMembers.mockResolvedValue([])
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// Fills the required trip details and advances to "Who is going?".
async function goToPeopleStep(title = 'Lisbon') {
  fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), title)
  await act(async () => {
    fireEvent.press(screen.getByText('Continue'))
  })
}

describe('NewTripScreen - the CTA is never mute (spec 7.1)', () => {
  it('stays enabled on an empty form and surfaces the field error on press', async () => {
    render(<NewTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Continue'))
    })

    // The two halves the title claims: the button was pressable, and the press said why.
    expect(screen.getByText('Title is required')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeOnTheScreen()
    expect(mockCreateTrip).not.toHaveBeenCalled()
    expect(screen.queryByText('Who is going?')).toBeNull()
  })
})

describe('NewTripScreen - who is going', () => {
  it('adds a typed name as a chip, next to the fixed you chip', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    expect(screen.getByText('Who is going?')).toBeOnTheScreen()
    expect(screen.getByText('You')).toBeOnTheScreen()

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Léa')
    fireEvent.press(screen.getByText('Add'))

    expect(screen.getByText('Léa')).toBeOnTheScreen()
  })

  it('removes a chip again', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Léa')
    fireEvent.press(screen.getByText('Add'))
    fireEvent.press(screen.getByLabelText('Remove Léa'))

    expect(screen.queryByText('Léa')).toBeNull()
  })

  it('warns about a duplicate without refusing it', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    const input = screen.getByPlaceholderText('First name')
    fireEvent.changeText(input, 'Léa')
    fireEvent.press(screen.getByText('Add'))
    fireEvent.changeText(input, 'Léa')
    fireEvent.press(screen.getByText('Add'))

    expect(screen.getByText('Two people share this name.')).toBeOnTheScreen()
    expect(screen.getAllByText('Léa')).toHaveLength(2)

    // A third, distinct name must not clear a warning that is still true.
    fireEvent.changeText(input, 'Marco')
    fireEvent.press(screen.getByText('Add'))
    expect(screen.getByText('Two people share this name.')).toBeOnTheScreen()
  })

  // Step 2 lives in local state, so a header pop would leave the screen entirely and take the
  // whole filled-in form with it.
  it('walks back to the details rather than leaving the screen', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep('Lisbon')

    fireEvent.press(screen.getByLabelText('Back'))

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER).props.value).toBe('Lisbon')
    expect(screen.queryByText('Who is going?')).toBeNull()
  })
})

// Step 1 unmounts while step 2 is shown, so anything DestinationField latched locally is lost on
// the way back. The geocode-loss hint (edd76bf) is exactly such a latch, and losing it means the
// user is told nothing about a destination whose coordinates they dropped.
describe('NewTripScreen - the geocode warning survives a step round-trip', () => {
  it('still warns after Continue then Back', async () => {
    render(<NewTripScreen />)

    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Lisbon')
    // Pick a place, then edit it by hand: the coordinates are dropped and the hint appears.
    fireEvent.changeText(screen.getByPlaceholderText('Lisbon, Portugal'), 'Lisboa city')
    fireEvent.press(screen.getByText('Lisbon, Portugal'))
    fireEvent.changeText(screen.getByPlaceholderText('Lisbon, Portugal'), 'Lisboa centre')
    expect(screen.getByText('Pick a suggestion again to locate it.')).toBeOnTheScreen()

    await act(async () => {
      fireEvent.press(screen.getByText('Continue'))
    })
    fireEvent.press(screen.getByLabelText('Back'))

    expect(screen.getByText('Pick a suggestion again to locate it.')).toBeOnTheScreen()
  })
})

describe('NewTripScreen - submitting', () => {
  it('skips the places entirely on "later"', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    await act(async () => {
      fireEvent.press(screen.getByText('Later'))
    })

    expect(mockCreateTrip).toHaveBeenCalled()
    expect(mockAddGhostMembers).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trips/[id]', params: { id: 't1' } })
  })

  it('creates the trip first, then adds the places in order', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    const input = screen.getByPlaceholderText('First name')
    fireEvent.changeText(input, 'Léa')
    fireEvent.press(screen.getByText('Add'))
    fireEvent.changeText(input, 'Marco')
    fireEvent.press(screen.getByText('Add'))

    await act(async () => {
      fireEvent.press(screen.getByText('Create the trip'))
    })

    expect(mockCreateTrip).toHaveBeenCalled()
    expect(mockAddGhostMembers).toHaveBeenCalledWith({ tripId: 't1', names: ['Léa', 'Marco'] })
    expect(mockCreateTrip.mock.invocationCallOrder[0]).toBeLessThan(
      mockAddGhostMembers.mock.invocationCallOrder[0],
    )
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trips/[id]', params: { id: 't1' } })
  })

  // Pressing Create with a name still in the field is the most natural gesture in the form;
  // dropping that name would be silent data loss.
  it('keeps a name typed but not yet added', async () => {
    render(<NewTripScreen />)
    await goToPeopleStep()

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Léa')
    await act(async () => {
      fireEvent.press(screen.getByText('Create the trip'))
    })

    expect(mockAddGhostMembers).toHaveBeenCalledWith({ tripId: 't1', names: ['Léa'] })
  })

  it('does not navigate when the trip itself could not be created', async () => {
    mockCreateTrip.mockRejectedValue(new Error('nope'))
    render(<NewTripScreen />)
    await goToPeopleStep()

    await act(async () => {
      fireEvent.press(screen.getByText('Create the trip'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Could not create', 'nope')
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockAddGhostMembers).not.toHaveBeenCalled()
  })

  // A place the group can re-add in two taps must never cost them the trip they just created.
  it('still opens the trip when a place could not be added', async () => {
    mockAddGhostMembers.mockResolvedValue(['Marco'])
    render(<NewTripScreen />)
    await goToPeopleStep()

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Marco')
    fireEvent.press(screen.getByText('Add'))

    await act(async () => {
      fireEvent.press(screen.getByText('Create the trip'))
    })

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trips/[id]', params: { id: 't1' } }),
    )
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Marco'))
  })
})
