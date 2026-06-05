import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { type ReactNode } from 'react'

import { mmkvQueryPersister } from '@/lib/query-persister'
import { supabase } from '@/lib/supabase'
import { createQueryWrapper } from '@/test-utils/query-wrapper'

import { AuthProvider, useAuth } from './use-auth'

jest.mock('@/lib/supabase')
jest.mock('@/lib/query-persister', () => ({
  mmkvQueryPersister: {
    persistClient: jest.fn(),
    restoreClient: jest.fn(),
    removeClient: jest.fn(),
  },
}))
jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => {
    const match = url.match(/[?&]code=([^&]+)/)
    return { queryParams: match ? { code: match[1] } : {} }
  }),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}))

// The manual mock doesn't include exchangeCodeForSession - add it so the PKCE path can be tested.
const exchangeCode = jest.fn().mockResolvedValue({ data: {}, error: null })
;(supabase.auth as unknown as Record<string, unknown>).exchangeCodeForSession = exchangeCode

const onAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock

const mockSession: Session = {
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 3600,
  expires_at: 9_999_999_999,
  token_type: 'bearer',
  user: {
    id: 'u1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  },
}

// Builds a wrapper that nests AuthProvider inside a fresh QueryClientProvider.
function buildWrapper() {
  const { queryClient } = createQueryWrapper()

  let authCallback: ((event: string, session: Session | null) => void) | null = null
  const unsubscribe = jest.fn()

  onAuthStateChange.mockImplementation((cb: (event: string, session: Session | null) => void) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe } } }
  })

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }

  return { wrapper, queryClient, getAuthCallback: () => authCallback, unsubscribe }
}

beforeEach(() => {
  jest.clearAllMocks()
  exchangeCode.mockResolvedValue({ data: {}, error: null })
})

// ---------------------------------------------------------------------------
// useAuth guard
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const { wrapper } = createQueryWrapper()
    expect(() => renderHook(() => useAuth(), { wrapper })).toThrow(
      'useAuth must be used within an AuthProvider',
    )

    consoleError.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------

describe('AuthProvider', () => {
  it('starts with isLoading=true and session=null before any auth event', () => {
    // onAuthStateChange does NOT fire the callback synchronously here.
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.session).toBeNull()
  })

  it('sets the session and clears isLoading when INITIAL_SESSION fires', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('INITIAL_SESSION', mockSession)
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.session).toEqual(mockSession)
  })

  it('clears the session and calls queryClient.clear() on SIGNED_OUT', async () => {
    const { wrapper, getAuthCallback, queryClient } = buildWrapper()
    const clearSpy = jest.spyOn(queryClient, 'clear')

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Sign in first.
    act(() => {
      getAuthCallback()?.('INITIAL_SESSION', mockSession)
    })
    await waitFor(() => expect(result.current.session).toEqual(mockSession))

    // Then sign out.
    act(() => {
      getAuthCallback()?.('SIGNED_OUT', null)
    })
    await waitFor(() => expect(result.current.session).toBeNull())
    expect(clearSpy).toHaveBeenCalled()
    // Purge the persisted MMKV cache too, so the next account can't restore this user's data.
    expect(mmkvQueryPersister.removeClient).toHaveBeenCalled()
  })

  it('starts with recovering=false', () => {
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.recovering).toBe(false)
  })

  it('sets recovering=true on PASSWORD_RECOVERY', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('PASSWORD_RECOVERY', mockSession)
    })

    await waitFor(() => expect(result.current.recovering).toBe(true))
  })

  it('clears recovering on USER_UPDATED (password set)', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('PASSWORD_RECOVERY', mockSession)
    })
    await waitFor(() => expect(result.current.recovering).toBe(true))

    act(() => {
      getAuthCallback()?.('USER_UPDATED', mockSession)
    })
    await waitFor(() => expect(result.current.recovering).toBe(false))
  })

  it('clears recovering on SIGNED_OUT', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('PASSWORD_RECOVERY', mockSession)
    })
    await waitFor(() => expect(result.current.recovering).toBe(true))

    act(() => {
      getAuthCallback()?.('SIGNED_OUT', null)
    })
    await waitFor(() => expect(result.current.recovering).toBe(false))
  })

  it('clears recovering when clearRecovery() is called (deterministic end of reset flow)', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('PASSWORD_RECOVERY', mockSession)
    })
    await waitFor(() => expect(result.current.recovering).toBe(true))

    act(() => {
      result.current.clearRecovery()
    })
    await waitFor(() => expect(result.current.recovering).toBe(false))
  })

  it('unsubscribes from onAuthStateChange when unmounted', () => {
    const { wrapper, unsubscribe } = buildWrapper()
    const { unmount } = renderHook(() => useAuth(), { wrapper })

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('resolves isLoading=false when a null session is reported (no active user)', async () => {
    const { wrapper, getAuthCallback } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      getAuthCallback()?.('INITIAL_SESSION', null)
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.session).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PKCE deep-link exchange (exchangeCodeFromUrl)
// ---------------------------------------------------------------------------

describe('exchangeCodeFromUrl (via expo-linking)', () => {
  const Linking = jest.requireMock('expo-linking') as {
    getInitialURL: jest.Mock
    addEventListener: jest.Mock
    parse: jest.Mock
  }

  it('exchanges a code from the initial URL', async () => {
    Linking.getInitialURL.mockResolvedValue('zyph://auth/callback?code=abc123')
    const { wrapper } = buildWrapper()

    renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(exchangeCode).toHaveBeenCalledWith('abc123'))
  })

  it('does not call exchangeCodeForSession when initial URL has no code', async () => {
    Linking.getInitialURL.mockResolvedValue('zyph://auth/callback')
    const { wrapper } = buildWrapper()

    renderHook(() => useAuth(), { wrapper })

    // Give the async effect a tick to settle.
    await act(() => Promise.resolve())
    expect(exchangeCode).not.toHaveBeenCalled()
  })

  it('does not call exchangeCodeForSession when initial URL is null', async () => {
    Linking.getInitialURL.mockResolvedValue(null)
    const { wrapper } = buildWrapper()

    renderHook(() => useAuth(), { wrapper })

    await act(() => Promise.resolve())
    expect(exchangeCode).not.toHaveBeenCalled()
  })

  it('exchanges a code when a url event is fired after mount', async () => {
    Linking.getInitialURL.mockResolvedValue(null)

    let urlEventHandler: ((event: { url: string }) => void) | null = null
    Linking.addEventListener.mockImplementation(
      (_event: string, handler: (event: { url: string }) => void) => {
        urlEventHandler = handler
        return { remove: jest.fn() }
      },
    )

    const { wrapper } = buildWrapper()
    renderHook(() => useAuth(), { wrapper })

    act(() => {
      urlEventHandler?.({ url: 'zyph://auth/callback?code=xyz789' })
    })

    await waitFor(() => expect(exchangeCode).toHaveBeenCalledWith('xyz789'))
  })

  it('swallows a rejected exchangeCodeForSession (expired/used link)', async () => {
    // An expired or already-used link rejects; the .catch must absorb it without
    // throwing an unhandled rejection or surfacing an error to the caller.
    Linking.getInitialURL.mockResolvedValue('zyph://auth/callback?code=expired')
    exchangeCode.mockRejectedValue(new Error('invalid grant'))

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(exchangeCode).toHaveBeenCalledWith('expired'))
    // The rejection is swallowed: session stays unchanged (no active user yet).
    await act(() => Promise.resolve())
    expect(result.current.session).toBeNull()
  })

  it('removes the url event listener on unmount', () => {
    Linking.getInitialURL.mockResolvedValue(null)
    const remove = jest.fn()
    Linking.addEventListener.mockReturnValue({ remove })

    const { wrapper } = buildWrapper()
    const { unmount } = renderHook(() => useAuth(), { wrapper })

    unmount()

    expect(remove).toHaveBeenCalled()
  })
})
