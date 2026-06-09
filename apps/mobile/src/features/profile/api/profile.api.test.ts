import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { getProfile, updateProfile, uploadAvatar } from './profile.api'

jest.mock('@/lib/supabase')

// Stub expo-file-system's File so new File(uri).arrayBuffer() is controllable.
let mockArrayBuffer: () => Promise<ArrayBuffer>
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    arrayBuffer: () => mockArrayBuffer(),
  })),
}))

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock
const storageFrom = supabase.storage.from as jest.Mock

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
  mockArrayBuffer = () => Promise.resolve(new ArrayBuffer(8))
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
  function makeStorageMock(uploadError: Error | null = null) {
    return {
      upload: jest.fn().mockResolvedValue({ data: { path: 'u1/avatar' }, error: uploadError }),
      getPublicUrl: jest.fn().mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/avatars/u1/avatar' },
      }),
    }
  }

  it('uploads the image and writes the public url onto the profile', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    const updated = { ...profile, avatar_url: 'https://cdn.example.com/avatars/u1/avatar?v=1' }
    const builder = makeQueryBuilder({ data: updated, error: null })
    from.mockReturnValue(builder)

    await expect(uploadAvatar('file:///cache/pic.jpg', 'image/jpeg')).resolves.toEqual(updated)

    expect(storageFrom).toHaveBeenCalledWith('avatars')
    expect(storage.upload).toHaveBeenCalledWith(
      'u1/avatar',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    )
    expect(builder.update).toHaveBeenCalledWith({
      avatar_url: expect.stringContaining('https://cdn.example.com/avatars/u1/avatar?v='),
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('falls back to image/jpeg when the content type is empty', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    from.mockReturnValue(makeQueryBuilder({ data: profile, error: null }))

    await uploadAvatar('file:///cache/pic', '')

    expect(storage.upload).toHaveBeenCalledWith(
      'u1/avatar',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(uploadAvatar('file:///x.jpg', 'image/jpeg')).rejects.toThrow('signed in')
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('rejects when the image is 0 bytes', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    mockArrayBuffer = () => Promise.resolve(new ArrayBuffer(0))

    await expect(uploadAvatar('file:///x.jpg', 'image/jpeg')).rejects.toThrow('empty')
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('throws when the storage upload fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    storageFrom.mockReturnValue(makeStorageMock(new Error('storage error')))

    await expect(uploadAvatar('file:///x.jpg', 'image/jpeg')).rejects.toThrow('storage error')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the profile update fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    storageFrom.mockReturnValue(makeStorageMock())
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('rls denied') }))

    await expect(uploadAvatar('file:///x.jpg', 'image/jpeg')).rejects.toThrow('rls denied')
  })
})
