import { renderHook, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'

import { usePushNotificationResponder } from './use-push-responder'

// Stable router (its identity must not churn across renders, mirroring expo-router's real router).
const mockRouter = { push: jest.fn() }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}))

const getLast = jest.mocked(Notifications.getLastNotificationResponseAsync)
const addListener = jest.mocked(Notifications.addNotificationResponseReceivedListener)
type Sub = ReturnType<typeof Notifications.addNotificationResponseReceivedListener>

function response(data: Record<string, unknown>): Notifications.NotificationResponse {
  return {
    notification: { request: { content: { data } } },
  } as unknown as Notifications.NotificationResponse
}

beforeEach(() => {
  jest.clearAllMocks()
  getLast.mockResolvedValue(null)
  addListener.mockReturnValue({ remove: jest.fn() } as unknown as Sub)
})

describe('usePushNotificationResponder', () => {
  it('does nothing when disabled, even with a pending cold-start response', async () => {
    getLast.mockResolvedValue(response({ type: 'expense.added', tripId: 't1', expenseId: 'e1' }))

    renderHook(() => usePushNotificationResponder(false))
    await Promise.resolve()

    expect(addListener).not.toHaveBeenCalled()
    expect(getLast).not.toHaveBeenCalled()
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('routes a cold-start tap once and does not re-route on re-render', async () => {
    getLast.mockResolvedValue(response({ type: 'expense.added', tripId: 't1', expenseId: 'e1' }))

    const { rerender } = renderHook<void, { enabled: boolean }>(
      ({ enabled }) => usePushNotificationResponder(enabled),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1))
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/expenses/[expenseId]',
      params: { id: 't1', expenseId: 'e1' },
    })

    rerender({ enabled: true })
    await Promise.resolve()
    expect(mockRouter.push).toHaveBeenCalledTimes(1)
  })

  it('routes a warm tap through the response listener', async () => {
    renderHook(() => usePushNotificationResponder(true))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    const onResponse = addListener.mock.calls[0][0]
    onResponse(response({ type: 'event.added', tripId: 't1', eventId: 'ev1' }))

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/events/[eventId]',
      params: { id: 't1', eventId: 'ev1' },
    })
  })

  it('ignores a push payload without a type', async () => {
    renderHook(() => usePushNotificationResponder(true))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    addListener.mock.calls[0][0](response({ tripId: 't1' }))

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('removes the subscription on unmount', async () => {
    const remove = jest.fn()
    addListener.mockReturnValue({ remove } as unknown as Sub)

    const { unmount } = renderHook(() => usePushNotificationResponder(true))
    await waitFor(() => expect(addListener).toHaveBeenCalled())
    unmount()

    expect(remove).toHaveBeenCalled()
  })
})
