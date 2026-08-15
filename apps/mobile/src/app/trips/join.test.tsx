import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import JoinTripScreen from './join'

const mockUseClaimOptions = jest.fn()
const mockClaimSlot = jest.fn()
const mockReplace = jest.fn()
const mockRefetch = jest.fn()
let mockSearchParams: { code?: string } = {}

jest.mock('@/lib/supabase')

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('@/features/group', () => ({
  ...jest.requireActual('@/features/group'),
  useClaimOptions: (code: string) => mockUseClaimOptions(code),
  useClaimSlot: () => ({ mutateAsync: mockClaimSlot, isPending: false }),
}))

type OptionsState = {
  data?: {
    tripId: string
    tripTitle: string
    myStatus: 'invited' | 'active' | 'removed' | null
    slots: { slotId: string; slotName: string | null }[]
  }
  isLoading?: boolean
  error?: Error | null
}

function mockOptions({ data, isLoading = false, error = null }: OptionsState) {
  mockUseClaimOptions.mockReturnValue({ data, isLoading, error, refetch: mockRefetch })
}

const LEA = { slotId: '11111111-1111-1111-1111-111111111111', slotName: 'Léa' }
const MARCO = { slotId: '22222222-2222-2222-2222-222222222222', slotName: 'Marco' }

function options(over: Partial<NonNullable<OptionsState['data']>> = {}) {
  return {
    tripId: 't1',
    tripTitle: 'Lisbonne',
    myStatus: null,
    slots: [] as { slotId: string; slotName: string | null }[],
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParams = { code: 'ZYPH1234' }
  mockClaimSlot.mockResolvedValue('t1')
  mockOptions({ data: undefined, isLoading: true })
})

describe('JoinTripScreen - code entry', () => {
  it('asks for a code when the deep link carries none', () => {
    mockSearchParams = {}
    mockOptions({ data: undefined, isLoading: false })
    render(<JoinTripScreen />)

    expect(screen.getByPlaceholderText('ZYPH-XXXX')).toBeOnTheScreen()
    // Nothing is fetched until a code is actually submitted.
    expect(mockUseClaimOptions).toHaveBeenLastCalledWith('')
  })

  it('fetches the options rather than joining outright once a code is submitted', async () => {
    mockSearchParams = {}
    mockOptions({ data: undefined, isLoading: false })
    render(<JoinTripScreen />)

    fireEvent.changeText(screen.getByPlaceholderText('ZYPH-XXXX'), 'zyph1234')
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'))
    })

    expect(mockUseClaimOptions).toHaveBeenLastCalledWith('ZYPH1234')
    expect(mockClaimSlot).not.toHaveBeenCalled()
  })

  it('re-fetches when the same refused code is submitted again', async () => {
    mockOptions({ data: undefined, error: new Error('invalid invite code') })
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Continue'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('says the attempts are spent rather than blaming the code', () => {
    mockOptions({ data: undefined, error: new Error('rate limited') })
    render(<JoinTripScreen />)

    expect(screen.getByText('Too many attempts. Try again a bit later.')).toBeOnTheScreen()
    expect(screen.queryByText('Check the code and try again.')).toBeNull()
  })

  it('shows the code form again when the code is refused', () => {
    mockOptions({ data: undefined, error: new Error('invalid invite code') })
    render(<JoinTripScreen />)

    expect(screen.getByPlaceholderText('ZYPH-XXXX')).toBeOnTheScreen()
    expect(screen.getByText('Check the code and try again.')).toBeOnTheScreen()
  })
})

describe('JoinTripScreen - who are you', () => {
  it('redirects straight to the trip when already an active member', async () => {
    mockOptions({ data: options({ myStatus: 'active', slots: [LEA] }) })
    render(<JoinTripScreen />)

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trips/[id]', params: { id: 't1' } }),
    )
    expect(screen.queryByText('Léa')).toBeNull()
  })

  it('lists the free places by name', () => {
    mockOptions({ data: options({ slots: [LEA, MARCO] }) })
    render(<JoinTripScreen />)

    expect(screen.getByText('Who are you?')).toBeOnTheScreen()
    expect(screen.getByText('Léa')).toBeOnTheScreen()
    expect(screen.getByText('Marco')).toBeOnTheScreen()
  })

  it('claims the picked place and lands in the trip', async () => {
    mockOptions({ data: options({ slots: [LEA, MARCO] }) })
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Léa'))
    })

    expect(mockClaimSlot).toHaveBeenCalledWith({ code: 'ZYPH1234', slotId: LEA.slotId })
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trips/[id]', params: { id: 't1' } })
  })

  it('offers "I am not in the list" as a claim with no slot', async () => {
    mockOptions({ data: options({ slots: [LEA] }) })
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('I am not in the list'))
    })

    expect(mockClaimSlot).toHaveBeenCalledWith({ code: 'ZYPH1234', slotId: null })
  })

  it('makes the no-slot path the main action when nobody was pre-listed', () => {
    mockOptions({ data: options({ slots: [] }) })
    render(<JoinTripScreen />)

    expect(screen.getByText('No one is waiting for a name yet.')).toBeOnTheScreen()
    expect(screen.getByText('I am not in the list')).toBeOnTheScreen()
  })
})

// claim_trip_slot short-circuits on an existing row BEFORE it reads _slot_id: a dormant member who
// tapped a named place would silently reactivate their own row instead, so the list must not be
// offered in these states at all.
describe('JoinTripScreen - a place is already held', () => {
  it.each(['removed', 'invited'] as const)('offers to reclaim it when status is %s', (myStatus) => {
    mockOptions({ data: options({ myStatus, slots: [LEA, MARCO] }) })
    render(<JoinTripScreen />)

    expect(screen.getByText('Take your place back')).toBeOnTheScreen()
    expect(screen.queryByText('Léa')).toBeNull()
    expect(screen.queryByText('Marco')).toBeNull()
    expect(screen.queryByText('I am not in the list')).toBeNull()
  })

  it('reclaims with no slot id', async () => {
    mockOptions({ data: options({ myStatus: 'removed' }) })
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Take it back'))
    })

    expect(mockClaimSlot).toHaveBeenCalledWith({ code: 'ZYPH1234', slotId: null })
  })
})

describe('JoinTripScreen - a place taken meanwhile', () => {
  // The claim landed but its answer did not. Reporting a failure would strand someone who IS a
  // member on the claim screen, with no way forward but the back button.
  it('treats "already a member" as arrival, not failure', async () => {
    mockOptions({ data: options({ slots: [LEA] }) })
    mockClaimSlot.mockRejectedValue(new Error('already a member'))
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Léa'))
    })

    expect(mockRefetch).toHaveBeenCalled()
    expect(screen.queryByText('Someone just took this place.')).toBeNull()
    expect(screen.queryByText('Check the code and try again.')).toBeNull()
  })

  // A refetch that fails keeps the data it already had; that list is still the right screen.
  it('keeps the list when a refetch fails after a good code', () => {
    mockOptions({ data: options({ slots: [LEA] }), error: new Error('network') })
    render(<JoinTripScreen />)

    expect(screen.getByText('Léa')).toBeOnTheScreen()
    expect(screen.queryByPlaceholderText('ZYPH-XXXX')).toBeNull()
  })

  it('surfaces the refusal and refreshes the list so the place disappears', async () => {
    mockOptions({ data: options({ slots: [LEA, MARCO] }) })
    mockClaimSlot.mockRejectedValue(new Error('slot already claimed'))
    render(<JoinTripScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Léa'))
    })

    expect(screen.getByText('Someone just took this place.')).toBeOnTheScreen()
    expect(mockRefetch).toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
