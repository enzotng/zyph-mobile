import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { getProfile } from './profile.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock

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
