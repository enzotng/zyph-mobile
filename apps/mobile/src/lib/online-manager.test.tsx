import { onlineManager } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

import { useIsOnline } from './online-manager'

afterEach(() => {
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
})
