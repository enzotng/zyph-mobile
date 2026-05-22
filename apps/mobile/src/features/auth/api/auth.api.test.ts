import { supabase } from '@/lib/supabase'
import { AUTH_REDIRECT_URL, signIn, signOut, signUp } from './auth.api'

jest.mock('@/lib/supabase')

const signUpMock = supabase.auth.signUp as jest.Mock
const signInMock = supabase.auth.signInWithPassword as jest.Mock
const signOutMock = supabase.auth.signOut as jest.Mock

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
