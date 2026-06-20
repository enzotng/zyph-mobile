import { render } from '@testing-library/react-native'

import { ShareIntentRouter } from './share-intent-router'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockSetPendingShare = jest.fn()
jest.mock('@/lib/preferences', () => ({
  setPendingShare: (...args: unknown[]) => mockSetPendingShare(...args),
}))

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: mockSession }),
}))

const mockResetShareIntent = jest.fn()
let mockContext: {
  hasShareIntent: boolean
  shareIntent: { text?: string | null; webUrl?: string | null } | null
} = { hasShareIntent: false, shareIntent: null }
jest.mock('expo-share-intent', () => ({
  useShareIntentContext: () => ({ ...mockContext, resetShareIntent: mockResetShareIntent }),
}))

describe('ShareIntentRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = { user: { id: 'u1' } }
    mockContext = { hasShareIntent: false, shareIntent: null }
  })

  it('does nothing when there is no share intent', () => {
    render(<ShareIntentRouter />)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockSetPendingShare).not.toHaveBeenCalled()
  })

  it('routes a signed-in user to the share handler with the shared text', () => {
    mockContext = { hasShareIntent: true, shareIntent: { text: 'Flight AF1234 confirmation' } }
    render(<ShareIntentRouter />)
    expect(mockResetShareIntent).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/share-handler',
      params: { text: 'Flight AF1234 confirmation' },
    })
    expect(mockSetPendingShare).not.toHaveBeenCalled()
  })

  it('falls back to the shared web URL when there is no text', () => {
    mockContext = {
      hasShareIntent: true,
      shareIntent: { text: null, webUrl: 'https://airline.example/booking/AF1234' },
    }
    render(<ShareIntentRouter />)
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/share-handler',
      params: { text: 'https://airline.example/booking/AF1234' },
    })
  })

  it('stashes the payload for replay when signed out', () => {
    mockSession = null
    mockContext = { hasShareIntent: true, shareIntent: { text: 'Hotel booking confirmation' } }
    render(<ShareIntentRouter />)
    expect(mockSetPendingShare).toHaveBeenCalledWith('Hotel booking confirmation')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('ignores a too-short payload but still clears the native intent', () => {
    mockContext = { hasShareIntent: true, shareIntent: { text: 'hi' } }
    render(<ShareIntentRouter />)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockSetPendingShare).not.toHaveBeenCalled()
    expect(mockResetShareIntent).toHaveBeenCalled()
  })
})
