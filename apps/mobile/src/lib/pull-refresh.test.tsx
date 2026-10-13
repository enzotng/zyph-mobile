import { act, renderHook } from '@testing-library/react-native'

import { usePullRefresh } from './pull-refresh'

jest.mock('./haptics', () => ({ haptics: { light: jest.fn() } }))

function deferred() {
  let settle = () => {}
  const promise = new Promise<void>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

describe('usePullRefresh', () => {
  it('spins from the pull until the refetches are back', async () => {
    const { promise, settle } = deferred()
    const refetchAll = jest.fn(() => promise)
    const { result } = renderHook(() => usePullRefresh(refetchAll, true))

    await act(async () => {
      void result.current.onRefresh()
    })

    expect(refetchAll).toHaveBeenCalledTimes(1)
    expect(result.current.refreshing).toBe(true)

    await act(async () => settle())

    expect(result.current.refreshing).toBe(false)
  })

  it('stops spinning when the refetches pause offline, though their promise never settles', async () => {
    const { result } = renderHook(() => usePullRefresh(() => new Promise(() => {}), false))

    await act(async () => {
      void result.current.onRefresh()
    })

    expect(result.current.refreshing).toBe(false)
  })

  // A background refetch (on focus, on mount) has no spinner to drive.
  it('does not spin for a fetch nobody pulled for', () => {
    const { result } = renderHook(() => usePullRefresh(jest.fn(), true))

    expect(result.current.refreshing).toBe(false)
  })

  it('stops spinning when a refetch rejects', async () => {
    const { result } = renderHook(() =>
      usePullRefresh(() => Promise.reject(new Error('offline')), true),
    )

    await act(async () => {
      await result.current.onRefresh().catch(() => {})
    })

    expect(result.current.refreshing).toBe(false)
  })
})
