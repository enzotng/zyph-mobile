import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { getProfile, updateProfile, uploadAvatar } from './profile.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock
const invoke = supabase.functions.invoke as jest.Mock

const profile = {
  id: 'u1',
  display_name: 'Alice',
  avatar_url: null,
  preferred_currency: 'EUR',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getProfile', () => {
  it('returns the profile for the signed-in user', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: profile, error: null })
    from.mockReturnValue(builder)

    await expect(getProfile()).resolves.toEqual(profile)
    expect(from).toHaveBeenCalledWith('profiles')
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1')
    expect(builder.single).toHaveBeenCalled()
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(getProfile()).rejects.toThrow('signed in')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the query errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('not found') }))

    await expect(getProfile()).rejects.toThrow('not found')
  })
})

describe('updateProfile', () => {
  const input = { displayName: 'Bob', preferredCurrency: 'USD' }

  it('updates the signed-in user profile and returns the new row', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: { ...profile, display_name: 'Bob' }, error: null })
    from.mockReturnValue(builder)

    await expect(updateProfile(input)).resolves.toEqual({ ...profile, display_name: 'Bob' })
    expect(from).toHaveBeenCalledWith('profiles')
    expect(builder.update).toHaveBeenCalledWith({
      display_name: 'Bob',
      preferred_currency: 'USD',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1')
    expect(builder.single).toHaveBeenCalled()
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(updateProfile(input)).rejects.toThrow('signed in')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the update errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('rls denied') }))

    await expect(updateProfile(input)).rejects.toThrow('rls denied')
  })
})

describe('uploadAvatar', () => {
  it('invokes the upload-avatar function and returns the updated profile', async () => {
    const updated = { ...profile, avatar_url: 'https://cdn.example.com/avatars/u1/avatar?v=1' }
    invoke.mockResolvedValue({ data: { profile: updated }, error: null })

    await expect(uploadAvatar('YmFzZTY0', 'image/jpeg')).resolves.toEqual(updated)
    expect(invoke).toHaveBeenCalledWith('upload-avatar', {
      body: { imageBase64: 'YmFzZTY0', contentType: 'image/jpeg' },
    })
  })

  it('surfaces the function error body on a non-2xx response', async () => {
    const httpError = new FunctionsHttpError({
      json: async () => ({ error: 'Unsupported image type' }),
    } as unknown as Response)
    invoke.mockResolvedValue({ data: null, error: httpError })

    await expect(uploadAvatar('YmFzZTY0', 'image/jpeg')).rejects.toThrow('Unsupported image type')
  })

  it('passes through a non-HTTP error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('network down') })

    await expect(uploadAvatar('YmFzZTY0', 'image/jpeg')).rejects.toThrow('network down')
  })

  it('throws when the function returns no profile', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(uploadAvatar('YmFzZTY0', 'image/jpeg')).rejects.toThrow('no profile')
  })
})
