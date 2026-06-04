import { onlineManager } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react-native'

import { OfflineBanner } from './offline-banner'

// useIsOnline reads from react-query's onlineManager singleton, so we drive the
// online/offline branches by flipping it (same approach as online-manager.test.tsx).
afterEach(() => {
  // Leave the singleton online so other suites are unaffected.
  act(() => {
    onlineManager.setOnline(true)
  })
})

describe('OfflineBanner', () => {
  it('renders nothing while online', () => {
    act(() => {
      onlineManager.setOnline(true)
    })

    render(<OfflineBanner />)

    expect(screen.queryByText('Offline - showing saved data')).toBeNull()
  })

  it('renders the offline banner message while offline', () => {
    act(() => {
      onlineManager.setOnline(false)
    })

    render(<OfflineBanner />)

    expect(screen.getByText('Offline - showing saved data')).toBeOnTheScreen()
  })

  it('toggles the banner when connectivity changes', () => {
    act(() => {
      onlineManager.setOnline(false)
    })

    render(<OfflineBanner />)

    expect(screen.getByText('Offline - showing saved data')).toBeOnTheScreen()

    act(() => {
      onlineManager.setOnline(true)
    })

    expect(screen.queryByText('Offline - showing saved data')).toBeNull()
  })
})
