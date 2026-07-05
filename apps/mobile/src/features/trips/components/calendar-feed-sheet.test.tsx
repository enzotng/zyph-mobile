import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { Alert } from 'react-native'

import { CalendarFeedSheet } from './calendar-feed-sheet'

// Fictional 64-char hex token, matching create_calendar_feed_token's real shape (sha-256 hex)
// without touching any real credential.
const TOKEN = 'a'.repeat(64)

type MutateOptions = { onSuccess?: (token: string) => void; onError?: (error: Error) => void }
const mockMutate = jest.fn<void, [string, MutateOptions?]>()
const mockHookState: { isPending: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isError: false,
  error: null,
}

// Stub the feature hook so no query client / real Supabase rpc is needed - the sheet only reads
// mutate/isPending/isError/error off it.
jest.mock('@/features/trips', () => ({
  useCreateCalendarFeedToken: () => ({ mutate: mockMutate, ...mockHookState }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }))
jest.mock('expo-linking', () => ({ openURL: jest.fn().mockResolvedValue(true) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockHookState.isPending = false
  mockHookState.isError = false
  mockHookState.error = null
  // Default: the create rpc "resolves" synchronously with a fixed token, as it would once its
  // real promise settles - lets most tests skip an explicit waitFor for the fetch-on-open effect.
  mockMutate.mockImplementation((_tripId, opts) => {
    opts?.onSuccess?.(TOKEN)
  })
})

describe('CalendarFeedSheet', () => {
  it('requests a token exactly once when the sheet opens', () => {
    const { rerender } = render(
      <CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />,
    )

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )

    // A parent re-render (props identical) must not re-fire the create rpc.
    rerender(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(mockMutate).toHaveBeenCalledTimes(1)
  })

  it('does not request a token while closed', () => {
    render(<CalendarFeedSheet open={false} onClose={() => undefined} tripId="trip-1" />)

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('requests a fresh token the next time the sheet is reopened', () => {
    const { rerender } = render(
      <CalendarFeedSheet open={false} onClose={() => undefined} tripId="trip-1" />,
    )
    expect(mockMutate).not.toHaveBeenCalled()

    rerender(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)
    expect(mockMutate).toHaveBeenCalledTimes(1)

    rerender(<CalendarFeedSheet open={false} onClose={() => undefined} tripId="trip-1" />)
    rerender(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)
    expect(mockMutate).toHaveBeenCalledTimes(2)
  })

  it('shows a loading state before the token arrives', () => {
    mockMutate.mockImplementation(() => {})
    mockHookState.isPending = true
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.queryByText('Subscribe')).not.toBeOnTheScreen()
  })

  it('opens a webcal:// url containing the token on Subscribe', () => {
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Subscribe'))

    expect(Linking.openURL).toHaveBeenCalledWith(
      `webcal://localhost:54321/functions/v1/calendar-feed?token=${TOKEN}`,
    )
  })

  it('copies the https:// url containing the token on Copy link', async () => {
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)

    fireEvent.press(screen.getByText('Copy link'))

    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        `https://localhost:54321/functions/v1/calendar-feed?token=${TOKEN}`,
      ),
    )
    expect(await screen.findByText('Link copied')).toBeOnTheScreen()
  })

  it('requests a new token when Revoke and regenerate is confirmed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)
    expect(mockMutate).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('Revoke and regenerate'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Revoke and regenerate?',
      'The current link will stop working immediately. Anyone using it will need the new one.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2]
    const confirm = buttons?.find((button) => button.text === 'Revoke and regenerate')
    confirm?.onPress?.()

    expect(mockMutate).toHaveBeenCalledTimes(2)
  })

  it('cancelling the regenerate confirm does not request a new token', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)
    expect(mockMutate).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('Revoke and regenerate'))

    const buttons = alertSpy.mock.calls[0]?.[2]
    const cancel = buttons?.find((button) => button.text === 'Cancel')
    cancel?.onPress?.()

    expect(mockMutate).toHaveBeenCalledTimes(1)
  })

  it('clears the stale token when a regenerate fails, falling back to the error state', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)
    // Initial fetch succeeded (default mock impl) - the ready actions are shown.
    expect(screen.getByText('Subscribe')).toBeOnTheScreen()

    // The regenerate rpc now fails - the create rpc may have already revoked the previous
    // token server-side before failing, so the stale one must not be left usable.
    mockMutate.mockImplementation((_tripId, opts) => {
      mockHookState.isError = true
      opts?.onError?.(new Error('not an active member'))
    })
    fireEvent.press(screen.getByText('Revoke and regenerate'))
    const buttons = alertSpy.mock.calls[0]?.[2]
    const confirm = buttons?.find((button) => button.text === 'Revoke and regenerate')
    act(() => {
      confirm?.onPress?.()
    })

    expect(screen.queryByText('Subscribe')).not.toBeOnTheScreen()
    expect(screen.queryByText('Copy link')).not.toBeOnTheScreen()
    expect(screen.getByText('Could not prepare the calendar link. Try again.')).toBeOnTheScreen()
  })

  it('shows a friendly retry message when the initial fetch fails - never the raw rpc error', () => {
    mockMutate.mockImplementation(() => {})
    mockHookState.isError = true
    mockHookState.error = new Error('not an active member')
    render(<CalendarFeedSheet open onClose={() => undefined} tripId="trip-1" />)

    expect(screen.getByText('Could not prepare the calendar link. Try again.')).toBeOnTheScreen()
    expect(screen.queryByText('not an active member')).not.toBeOnTheScreen()

    fireEvent.press(screen.getByText('Try again'))
    expect(mockMutate).toHaveBeenCalledTimes(2)
  })
})
