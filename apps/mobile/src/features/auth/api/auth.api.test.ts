import * as AppleAuthentication from 'expo-apple-authentication'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'
import {
  AUTH_REDIRECT_URL,
  requestPasswordReset,
  signIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
  signUp,
  updatePassword,
} from './auth.api'

jest.mock('@/lib/supabase')
jest.mock('expo-web-browser')
jest.mock('expo-linking')
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 1, EMAIL: 0 },
}))
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'raw-nonce',
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}))

const signUpMock = supabase.auth.signUp as jest.Mock
const signInMock = supabase.auth.signInWithPassword as jest.Mock
const signOutMock = supabase.auth.signOut as jest.Mock
const oauthMock = supabase.auth.signInWithOAuth as jest.Mock
const exchangeMock = supabase.auth.exchangeCodeForSession as jest.Mock
const getSessionMock = supabase.auth.getSession as jest.Mock
const openAuthMock = WebBrowser.openAuthSessionAsync as jest.Mock
const parseMock = Linking.parse as jest.Mock
const resetPasswordMock = supabase.auth.resetPasswordForEmail as jest.Mock
const updateUserMock = supabase.auth.updateUser as jest.Mock
const idTokenMock = supabase.auth.signInWithIdToken as jest.Mock
const appleSignInMock = AppleAuthentication.signInAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('signUp', () => {
  const values = { email: 'a@b.co', password: 'pw123456', displayName: 'Ana' }

  it('signs up with display name and redirect, returning data', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await expect(signUp(values)).resolves.toEqual({ user: { id: 'u1' } })
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw123456',
      options: {
        data: { display_name: 'Ana' },
        emailRedirectTo: AUTH_REDIRECT_URL,
      },
    })
  })

  it('throws on error', async () => {
    signUpMock.mockResolvedValue({ data: null, error: new Error('taken') })

    await expect(signUp(values)).rejects.toThrow('taken')
  })
})

describe('signIn', () => {
  const values = { email: 'a@b.co', password: 'pw123456' }

  it('signs in and returns data', async () => {
    signInMock.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null })

    await expect(signIn(values)).resolves.toEqual({ session: { access_token: 't' } })
    expect(signInMock).toHaveBeenCalledWith(values)
  })

  it('throws on error', async () => {
    signInMock.mockResolvedValue({ data: null, error: new Error('bad creds') })

    await expect(signIn(values)).rejects.toThrow('bad creds')
  })
})

describe('signOut', () => {
  it('resolves when sign-out succeeds', async () => {
    signOutMock.mockResolvedValue({ error: null })

    await expect(signOut()).resolves.toBeUndefined()
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('throws on error', async () => {
    signOutMock.mockResolvedValue({ error: new Error('offline') })

    await expect(signOut()).rejects.toThrow('offline')
  })
})

describe('requestPasswordReset', () => {
  it('sends a reset email with the auth redirect', async () => {
    resetPasswordMock.mockResolvedValue({ data: {}, error: null })

    await expect(requestPasswordReset('a@b.co')).resolves.toBeUndefined()
    expect(resetPasswordMock).toHaveBeenCalledWith('a@b.co', { redirectTo: AUTH_REDIRECT_URL })
  })

  it('throws on error', async () => {
    resetPasswordMock.mockResolvedValue({ data: null, error: new Error('rate limited') })

    await expect(requestPasswordReset('a@b.co')).rejects.toThrow('rate limited')
  })
})

describe('updatePassword', () => {
  it('updates the user password', async () => {
    updateUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await expect(updatePassword('pw123456')).resolves.toBeUndefined()
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'pw123456' })
  })

  it('throws on error', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: new Error('weak password') })

    await expect(updatePassword('pw123456')).rejects.toThrow('weak password')
  })
})

describe('signInWithGoogle', () => {
  const PROVIDER_URL = 'https://accounts.google.com/o/oauth2/auth'

  function mockProviderUrl() {
    oauthMock.mockResolvedValue({ data: { url: PROVIDER_URL }, error: null })
  }

  it('opens the provider URL and exchanges the returned code for a session', async () => {
    mockProviderUrl()
    openAuthMock.mockResolvedValue({ type: 'success', url: 'zyph://auth/callback?code=abc123' })
    parseMock.mockReturnValue({ queryParams: { code: 'abc123' } })
    exchangeMock.mockResolvedValue({ error: null })

    await expect(signInWithGoogle()).resolves.toEqual({ cancelled: false })
    expect(oauthMock).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
    })
    expect(openAuthMock).toHaveBeenCalledWith(PROVIDER_URL, AUTH_REDIRECT_URL)
    expect(exchangeMock).toHaveBeenCalledWith('abc123')
  })

  it('returns cancelled when the user dismisses the browser', async () => {
    mockProviderUrl()
    openAuthMock.mockResolvedValue({ type: 'cancel' })

    await expect(signInWithGoogle()).resolves.toEqual({ cancelled: true })
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('throws when Supabase cannot start the OAuth flow', async () => {
    oauthMock.mockResolvedValue({ data: null, error: new Error('provider is not enabled') })

    await expect(signInWithGoogle()).rejects.toThrow('provider is not enabled')
    expect(openAuthMock).not.toHaveBeenCalled()
  })

  it('throws when no provider URL is returned', async () => {
    oauthMock.mockResolvedValue({ data: { url: null }, error: null })

    await expect(signInWithGoogle()).rejects.toThrow('Could not start Google sign-in')
  })

  it('throws the provider error carried back on the callback URL', async () => {
    mockProviderUrl()
    openAuthMock.mockResolvedValue({
      type: 'success',
      url: 'zyph://auth/callback?error=access_denied',
    })
    parseMock.mockReturnValue({ queryParams: { error: 'access_denied' } })

    await expect(signInWithGoogle()).rejects.toThrow('access_denied')
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('throws when the callback carries no authorization code', async () => {
    mockProviderUrl()
    openAuthMock.mockResolvedValue({ type: 'success', url: 'zyph://auth/callback' })
    parseMock.mockReturnValue({ queryParams: {} })

    await expect(signInWithGoogle()).rejects.toThrow('no authorization code')
  })

  it('throws when the code exchange fails and no session resulted', async () => {
    mockProviderUrl()
    openAuthMock.mockResolvedValue({ type: 'success', url: 'zyph://auth/callback?code=abc123' })
    parseMock.mockReturnValue({ queryParams: { code: 'abc123' } })
    exchangeMock.mockResolvedValue({ error: new Error('invalid grant') })
    getSessionMock.mockResolvedValue({ data: { session: null } })

    await expect(signInWithGoogle()).rejects.toThrow('invalid grant')
  })

  it('succeeds when the deep-link listener already consumed the code (session exists)', async () => {
    // Android race: the global url listener exchanges first, so the manual exchange fails on
    // an already-used code - but a session now exists, so it must NOT be reported as an error.
    mockProviderUrl()
    openAuthMock.mockResolvedValue({ type: 'success', url: 'zyph://auth/callback?code=abc123' })
    parseMock.mockReturnValue({ queryParams: { code: 'abc123' } })
    exchangeMock.mockResolvedValue({ error: new Error('code verifier already used') })
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 't' } } })

    await expect(signInWithGoogle()).resolves.toEqual({ cancelled: false })
  })
})

describe('signInWithApple', () => {
  it('sends the hashed nonce to Apple and the raw nonce + identity token to Supabase', async () => {
    appleSignInMock.mockResolvedValue({ identityToken: 'apple-id-token' })
    idTokenMock.mockResolvedValue({ error: null })

    await expect(signInWithApple()).resolves.toEqual({ cancelled: false })
    expect(appleSignInMock).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }))
    expect(idTokenMock).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    })
  })

  it('returns cancelled when the user dismisses the Apple sheet', async () => {
    appleSignInMock.mockRejectedValue(
      Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' }),
    )

    await expect(signInWithApple()).resolves.toEqual({ cancelled: true })
    expect(idTokenMock).not.toHaveBeenCalled()
  })

  it('throws when Apple returns no identity token', async () => {
    appleSignInMock.mockResolvedValue({ identityToken: null })

    await expect(signInWithApple()).rejects.toThrow('no identity token')
    expect(idTokenMock).not.toHaveBeenCalled()
  })

  it('rethrows a Supabase sign-in error', async () => {
    appleSignInMock.mockResolvedValue({ identityToken: 'apple-id-token' })
    idTokenMock.mockResolvedValue({ error: new Error('Unverified email') })

    await expect(signInWithApple()).rejects.toThrow('Unverified email')
  })
})
