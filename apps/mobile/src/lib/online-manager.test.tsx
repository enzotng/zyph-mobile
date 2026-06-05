import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

import { useIsOnline } from './online-manager'

// Override only useSyncExternalStore so a test can drive its three callbacks directly
// (React itself never invokes getServerSnapshot in a client-only RTL render). When
// useSyncExternalStoreImpl is unset, the real hook runs and the rest of React is intact.
let mockUseSyncExternalStoreImpl:
  | (<T>(
      subscribe: (cb: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ) => T)
  | undefined
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useSyncExternalStore: <T,>(
      subscribe: (cb: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ): T =>
      (mockUseSyncExternalStoreImpl ?? actual.useSyncExternalStore)(
        subscribe,
        getSnapshot,
        getServerSnapshot,
      ),
  }
})

afterEach(() => {
  mockUseSyncExternalStoreImpl = undefined
  // Leave the singleton online so other suites are unaffected.
  act(() => {
    onlineManager.setOnline(true)
  })
})

describe('useIsOnline', () => {
  it('reflects the online-manager state', () => {
    const { result } = renderHook(() => useIsOnline())

    act(() => {
      onlineManager.setOnline(true)
    })
    expect(result.current).toBe(true)

    act(() => {
      onlineManager.setOnline(false)
    })
    expect(result.current).toBe(false)
  })

  it('wires subscribe, client snapshot and the server-snapshot fallback', () => {
    // Drive all three useSyncExternalStore args: subscribe registers/cleans up on the
    // onlineManager, the client snapshot reads its live state, and the server fallback
    // (third arg) resolves to online (true) - the path RTL never exercises on its own.
    let serverSnapshot: boolean | undefined
    let clientSnapshot: boolean | undefined
    mockUseSyncExternalStoreImpl = ((subscribe, getSnapshot, getServerSnapshot) => {
      const unsubscribe = subscribe(() => undefined)
      unsubscribe()
      clientSnapshot = getSnapshot() as boolean
      serverSnapshot = (getServerSnapshot as () => boolean)()
      return serverSnapshot
    }) as typeof mockUseSyncExternalStoreImpl

    act(() => {
      onlineManager.setOnline(false)
    })
    const { result } = renderHook(() => useIsOnline())

    expect(clientSnapshot).toBe(false)
    expect(serverSnapshot).toBe(true)
    expect(result.current).toBe(true)
  })
})

describe('NetInfo wiring', () => {
  it('mirrors connectivity changes into the online-manager', () => {
    // setEventListener (run at module import) registers a NetInfo listener via
    // NetInfo.addEventListener; grab that captured callback and drive it to cover the
    // setOnline(Boolean(state.isConnected)) bridge across both connectivity states.
    const addEventListener = NetInfo.addEventListener as jest.Mock
    expect(addEventListener).toHaveBeenCalled()
    const lastCall = addEventListener.mock.calls.at(-1) as unknown[]
    const netInfoListener = lastCall[0] as (state: { isConnected: boolean | null }) => void

    act(() => {
      netInfoListener({ isConnected: false })
    })
    expect(onlineManager.isOnline()).toBe(false)

    act(() => {
      netInfoListener({ isConnected: true })
    })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('treats a null isConnected as offline', () => {
    const addEventListener = NetInfo.addEventListener as jest.Mock
    const lastCall = addEventListener.mock.calls.at(-1) as unknown[]
    const netInfoListener = lastCall[0] as (state: { isConnected: boolean | null }) => void

    act(() => {
      netInfoListener({ isConnected: null })
    })
    expect(onlineManager.isOnline()).toBe(false)
  })
})
