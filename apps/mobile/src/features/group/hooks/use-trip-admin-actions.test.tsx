import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Alert, type AlertButton } from 'react-native'

import { tripInboxAddressQueryKey } from '@/features/trips'
import * as tripsApi from '@/features/trips/api/trips.api'
import { haptics } from '@/lib/haptics'
import { queryClient as appQueryClient } from '@/lib/query-client'
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

describe('offerNewInviteLink', () => {
  const INBOX = 'lisbonne-x7k2@zyph.enzotang.fr'

  beforeEach(() => {
    jest.mocked(tripsApi.getTripInboxAddress).mockResolvedValue(null)
  })

  async function offer(result: { current: ReturnType<typeof useTripAdminActions> }) {
    await act(async () => {
      await result.current.offerNewInviteLink('Léa')
    })
  }

  it('names who can still come back, and keeps the link unless asked', async () => {
    const { result } = renderActions()

    await offer(result)

    expect(alertSpy).toHaveBeenCalledWith(
      'Change the invite link too?',
      'Léa can still come back with the current link. A new one stops that, but you will need to send it again to anyone who has not joined yet.',
      expect.any(Array),
    )
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[]
    expect(buttons.map((button) => button.text)).toEqual(['Keep this link', 'Change link'])
    expect(api.regenerateInviteCode).not.toHaveBeenCalled()
  })

  it('regenerates the code when accepted', async () => {
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    const { result } = renderActions()

    await offer(result)
    await pressDestructive()

    expect(api.regenerateInviteCode).toHaveBeenCalledWith('t1')
    expect(tripsApi.createTripInboxAddress).not.toHaveBeenCalled()
  })

  // The trip email is a second way in: whoever knew it can keep sending bookings to the trip.
  it('offers to change the trip email too when the trip has one', async () => {
    jest
      .mocked(tripsApi.getTripInboxAddress)
      .mockResolvedValue({ address: INBOX, autoValidate: false })
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    jest.mocked(tripsApi.createTripInboxAddress).mockResolvedValue('lisbonne-q9w4@zyph.enzotang.fr')
    const { result } = renderActions()

    await offer(result)

    expect(alertSpy.mock.calls[0]?.[0]).toBe('Change the invite link and the trip email?')
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[]
    expect(buttons.map((button) => button.text)).toEqual(['Keep them', 'Change both'])

    await pressDestructive()

    expect(api.regenerateInviteCode).toHaveBeenCalledWith('t1')
    expect(jest.mocked(tripsApi.createTripInboxAddress).mock.calls[0]?.[0]).toBe('t1')
    expect(alertSpy).toHaveBeenLastCalledWith(
      'New trip email',
      'lisbonne-q9w4@zyph.enzotang.fr',
      expect.arrayContaining([expect.objectContaining({ text: 'Share' })]),
    )
  })

  // A new address starts with auto-validation off; rotating it must not change the group's setting.
  it('keeps auto-validation on for the new address', async () => {
    jest
      .mocked(tripsApi.getTripInboxAddress)
      .mockResolvedValue({ address: INBOX, autoValidate: true })
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    jest.mocked(tripsApi.createTripInboxAddress).mockResolvedValue('lisbonne-q9w4@zyph.enzotang.fr')
    jest.mocked(tripsApi.setTripInboxAutoValidate).mockResolvedValue()
    const { result } = renderActions()

    await offer(result)
    await pressDestructive()

    expect(tripsApi.setTripInboxAutoValidate).toHaveBeenCalledWith('t1', true)
  })

  it('says plainly when the link changed but the trip email did not', async () => {
    jest
      .mocked(tripsApi.getTripInboxAddress)
      .mockResolvedValue({ address: INBOX, autoValidate: false })
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    jest.mocked(tripsApi.createTripInboxAddress).mockRejectedValue(new Error('network'))
    const { result } = renderActions()

    await offer(result)
    await pressDestructive()

    expect(alertSpy).toHaveBeenLastCalledWith(
      'Could not regenerate',
      "The invite link changed, but the trip email did not. Change it from the trip's inbox settings.",
    )
  })

  it('says the trip email could not be checked when reading it fails', async () => {
    jest.mocked(tripsApi.getTripInboxAddress).mockRejectedValue(new Error('network'))
    const { result } = renderActions()

    await offer(result)

    expect(alertSpy.mock.calls[0]?.[0]).toBe('Change the invite link too?')
    expect(alertSpy.mock.calls[0]?.[1]).toContain('The trip email could not be checked')
  })

  // Under the app's own query defaults - retries and a 30 s staleTime - rather than the test
  // wrapper's, which would hide both.
  describe('with the app query client', () => {
    function renderWithAppClient() {
      function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={appQueryClient}>{children}</QueryClientProvider>
      }
      return renderHook(() => useTripAdminActions('t1'), { wrapper })
    }

    afterEach(() => {
      appQueryClient.clear()
    })

    it('reads the trip email once, so a failure does not hold the offer back', async () => {
      jest.mocked(tripsApi.getTripInboxAddress).mockRejectedValue(new Error('network'))
      const { result } = renderWithAppClient()

      await offer(result)

      expect(tripsApi.getTripInboxAddress).toHaveBeenCalledTimes(1)
      expect(alertSpy).toHaveBeenCalledTimes(1)
    })

    it('reads the trip email fresh rather than trusting a cached answer', async () => {
      appQueryClient.setQueryData(tripInboxAddressQueryKey('t1'), null)
      jest
        .mocked(tripsApi.getTripInboxAddress)
        .mockResolvedValue({ address: INBOX, autoValidate: false })
      const { result } = renderWithAppClient()

      await offer(result)

      expect(alertSpy.mock.calls[0]?.[0]).toBe('Change the invite link and the trip email?')
    })
  })
})
