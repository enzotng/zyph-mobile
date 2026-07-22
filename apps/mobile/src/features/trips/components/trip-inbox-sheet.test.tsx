import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { Alert, Share } from 'react-native'

import { TripInboxSheet } from './trip-inbox-sheet'

// Fictional address matching create_trip_inbox_address's real shape (slug + zyph domain).
const ADDRESS = 'roadtrip-test-a1b2c3@zyph.enzotang.fr'

type MutateOptions<T> = { onSuccess?: (result?: T) => void; onError?: (error: Error) => void }
const mockCreateMutate = jest.fn<void, [string, MutateOptions<string>?]>()
const mockSetAutoValidateMutate = jest.fn<
  void,
  [{ tripId: string; on: boolean }, MutateOptions<void>?]
>()

const mockAddressState: {
  data: { address: string; autoValidate: boolean } | null | undefined
  isLoading: boolean
  isError: boolean
  refetch: jest.Mock
} = {
  data: null,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
}
const mockCreateState = { isPending: false }
const mockSetAutoValidateState = { isPending: false }

// Stub the feature hooks so no query client / real Supabase rpc is needed - the sheet only reads
// data/isLoading/isError off the query hook and mutate/isPending off the mutation hooks.
jest.mock('@/features/trips', () => ({
  useTripInboxAddress: () => mockAddressState,
  useCreateTripInboxAddress: () => ({ mutate: mockCreateMutate, ...mockCreateState }),
  useSetTripInboxAutoValidate: () => ({
    mutate: mockSetAutoValidateMutate,
    ...mockSetAutoValidateState,
  }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockAddressState.data = null
  mockAddressState.isLoading = false
  mockAddressState.isError = false
  mockCreateState.isPending = false
  mockSetAutoValidateState.isPending = false
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

describe('TripInboxSheet', () => {
  it('shows a loading state while the address query is loading', () => {
    mockAddressState.isLoading = true
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.queryByText('Generate address')).not.toBeOnTheScreen()
  })

  it('shows a friendly retry message when the address query fails', () => {
    mockAddressState.isError = true
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Try again'))
    expect(mockAddressState.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows a Generate button when no address exists yet, without auto-creating one', () => {
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.getByText('Generate address')).toBeOnTheScreen()
    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('generates the address on Generate press', () => {
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Generate address'))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('renders the address plus its actions when one exists', () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.getByText(ADDRESS)).toBeOnTheScreen()
    expect(screen.getByText('Copy')).toBeOnTheScreen()
    expect(screen.getByText('Share')).toBeOnTheScreen()
    expect(screen.getByText('Regenerate')).toBeOnTheScreen()
  })

  it('copies the address on Copy', async () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Copy'))

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(ADDRESS))
    expect(await screen.findByText('Copied!')).toBeOnTheScreen()
  })

  it('shares the address on Share', () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Share'))

    expect(Share.share).toHaveBeenCalledWith({ message: ADDRESS })
  })

  it('regenerates the address when the confirm alert is accepted', () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Regenerate'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Regenerate the address?',
      'The old address and any auto-forward rules pointing to it will stop working immediately.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2]
    const confirm = buttons?.find((button) => button.text === 'Regenerate')
    confirm?.onPress?.()

    expect(mockCreateMutate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('cancelling the regenerate confirm does not request a new address', () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Regenerate'))

    const buttons = alertSpy.mock.calls[0]?.[2]
    const cancel = buttons?.find((button) => button.text === 'Cancel')
    cancel?.onPress?.()

    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('toggles auto-validate through the switch', () => {
    mockAddressState.data = { address: ADDRESS, autoValidate: false }
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent(screen.getByLabelText('Auto-validate imports'), 'valueChange', true)

    expect(mockSetAutoValidateMutate).toHaveBeenCalledWith(
      { tripId: 'trip-1', on: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('shows a friendly alert when generating the address fails - never the raw rpc error', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    mockCreateMutate.mockImplementation((_tripId, opts) => {
      opts?.onError?.(new Error('not an active member'))
    })
    render(<TripInboxSheet open onClose={() => undefined} tripId="trip-1" />)

    act(() => {
      fireEvent.press(screen.getByText('Generate address'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Something went wrong. Try again.')
  })
})
