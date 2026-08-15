import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'

import * as tripsApi from '@/features/trips/api/trips.api'
import { haptics } from '@/lib/haptics'
import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/group.api'
import { useTripAdminActions } from './use-trip-admin-actions'

jest.mock('@/lib/supabase')
jest.mock('../api/group.api')
jest.mock('@/features/trips/api/trips.api')

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

let alertSpy: jest.SpyInstance
let warningSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  warningSpy = jest.spyOn(haptics, 'warning').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

function renderActions() {
  const { wrapper } = createQueryWrapper()
  return renderHook(() => useTripAdminActions('t1'), { wrapper })
}

// The destructive button of the Nth Alert.alert call, invoked and flushed like a real tap.
async function pressDestructive(callIndex = 0) {
  const buttons = alertSpy.mock.calls[callIndex]?.[2] as AlertButton[] | undefined
  const confirm = buttons?.find((button) => button.style === 'destructive')
  expect(confirm).toBeDefined()
  await act(async () => {
    confirm?.onPress?.()
  })
}

describe('confirmRegenerate', () => {
  it('warns and asks for confirmation in the active language', () => {
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())

    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      'Regenerate invite code',
      'The current code will stop working. People who already joined keep their access.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[]
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Regenerate'])
  })

  it('regenerates the code when confirmed', async () => {
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    expect(api.regenerateInviteCode).toHaveBeenCalledWith('t1')
  })

  it('does nothing when cancelled', () => {
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    const cancel = (alertSpy.mock.calls[0]?.[2] as AlertButton[]).find(
      (button) => button.style === 'cancel',
    )

    expect(cancel?.onPress).toBeUndefined()
    expect(api.regenerateInviteCode).not.toHaveBeenCalled()
  })

  it('surfaces the failure message in the active language', async () => {
    jest.mocked(api.regenerateInviteCode).mockRejectedValue(new Error('rate limited'))
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    expect(alertSpy).toHaveBeenLastCalledWith('Could not regenerate', 'rate limited')
  })

  // The discrimination is on SQLSTATE, and both existing tests reject plain Errors with no code -
  // so neither could tell the branch from `error.message` alone.
  it('hides a Postgres error that talks about the schema', async () => {
    jest.mocked(api.regenerateInviteCode).mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "trip_members_trip_id_user_id_key"',
    })
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    expect(alertSpy).toHaveBeenLastCalledWith('Could not regenerate', 'Please try again.')
  })

  it('shows a raise the RPC wrote for the user', async () => {
    const raised = Object.assign(new Error('owner cannot leave'), { code: 'P0001' })
    jest.mocked(api.regenerateInviteCode).mockRejectedValue(raised)
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    expect(alertSpy).toHaveBeenLastCalledWith('Could not regenerate', 'owner cannot leave')
  })

  it('falls back to the generic retry copy for a non-Error rejection', async () => {
    jest.mocked(api.regenerateInviteCode).mockRejectedValue('boom')
    const { result } = renderActions()

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    expect(alertSpy).toHaveBeenLastCalledWith('Could not regenerate', 'Please try again.')
  })

  it('exposes the pending state', async () => {
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    const { result } = renderActions()

    expect(result.current.isRegenerating).toBe(false)

    act(() => result.current.confirmRegenerate())
    await pressDestructive()

    await waitFor(() => expect(result.current.isRegenerating).toBe(false))
  })
})

describe('confirmDelete', () => {
  it('warns and asks for confirmation in the active language', () => {
    const { result } = renderActions()

    act(() => result.current.confirmDelete())

    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete trip',
      'This permanently deletes the trip and all its data.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[]
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Delete'])
  })

  it('deletes the trip and goes home when confirmed', async () => {
    jest.mocked(tripsApi.deleteTrip).mockResolvedValue(undefined)
    const { result } = renderActions()

    act(() => result.current.confirmDelete())
    await pressDestructive()

    expect(tripsApi.deleteTrip).toHaveBeenCalledWith('t1', expect.anything())
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('stays on the trip and reports the failure when the delete fails', async () => {
    jest.mocked(tripsApi.deleteTrip).mockRejectedValue(new Error('nope'))
    const { result } = renderActions()

    act(() => result.current.confirmDelete())
    await pressDestructive()

    expect(mockReplace).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenLastCalledWith('Could not delete', 'nope')
  })

  it('exposes the pending state', () => {
    const { result } = renderActions()

    expect(result.current.isDeleting).toBe(false)
  })
})

describe('confirmLeave', () => {
  it('warns and asks for confirmation in the active language', () => {
    const { result } = renderActions()

    act(() => result.current.confirmLeave())

    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      'Leave trip',
      'You will no longer see this trip or its expenses. Past expenses you paid or owe are still counted.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[]
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Leave'])
  })

  it('leaves the trip and goes home when confirmed', async () => {
    jest.mocked(api.leaveTrip).mockResolvedValue(undefined)
    const { result } = renderActions()

    act(() => result.current.confirmLeave())
    await pressDestructive()

    expect(api.leaveTrip).toHaveBeenCalledWith('t1', expect.anything())
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('stays on the trip and reports the failure when leaving fails', async () => {
    jest.mocked(api.leaveTrip).mockRejectedValue(new Error('still owes'))
    const { result } = renderActions()

    act(() => result.current.confirmLeave())
    await pressDestructive()

    expect(mockReplace).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenLastCalledWith('Could not leave', 'still owes')
  })

  it('exposes the pending state', () => {
    const { result } = renderActions()

    expect(result.current.isLeaving).toBe(false)
  })
})
