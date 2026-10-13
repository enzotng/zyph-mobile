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
  it('does nothing when signed out, even with a pending cold-start response', async () => {
    getLast.mockResolvedValue(response({ type: 'expense.added', tripId: 't1', expenseId: 'e1' }))

    renderHook(() => usePushNotificationResponder(null))
    await Promise.resolve()

    expect(addListener).not.toHaveBeenCalled()
    expect(getLast).not.toHaveBeenCalled()
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('routes a cold-start tap once and does not re-route on re-render', async () => {
    getLast.mockResolvedValue(response({ type: 'expense.added', tripId: 't1', expenseId: 'e1' }))

    const { rerender } = renderHook<void, { userId: string | null }>(
      ({ userId }) => usePushNotificationResponder(userId),
      { initialProps: { userId: 'u1' } },
    )

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1))
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/expenses/[expenseId]',
      params: { id: 't1', expenseId: 'e1' },
    })

    rerender({ userId: 'u1' })
    await Promise.resolve()
    expect(mockRouter.push).toHaveBeenCalledTimes(1)
  })

  it('routes a warm tap through the response listener', async () => {
    renderHook(() => usePushNotificationResponder('u1'))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    const onResponse = addListener.mock.calls[0][0]
    onResponse(response({ type: 'event.added', tripId: 't1', eventId: 'ev1' }))

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/events/[eventId]',
      params: { id: 't1', eventId: 'ev1' },
    })
  })

  it('ignores a push payload without a type', async () => {
    renderHook(() => usePushNotificationResponder('u1'))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    addListener.mock.calls[0][0](response({ tripId: 't1' }))

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('does not route the detached account on a detach push', async () => {
    renderHook(() => usePushNotificationResponder('u1'))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    addListener.mock.calls[0][0](
      response({ type: 'member.detached', tripId: 't1', detachedUserId: 'u1' }),
    )

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('routes a detach push for another member to the group screen', async () => {
    renderHook(() => usePushNotificationResponder('u1'))
    await waitFor(() => expect(addListener).toHaveBeenCalled())

    addListener.mock.calls[0][0](
      response({ type: 'member.detached', tripId: 't1', detachedUserId: 'u2' }),
    )

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/group',
      params: { id: 't1' },
    })
  })

  it('removes the subscription on unmount', async () => {
    const remove = jest.fn()
    addListener.mockReturnValue({ remove } as unknown as Sub)

    const { unmount } = renderHook(() => usePushNotificationResponder('u1'))
    await waitFor(() => expect(addListener).toHaveBeenCalled())
    unmount()

    expect(remove).toHaveBeenCalled()
  })
})
