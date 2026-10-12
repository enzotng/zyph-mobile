import { guardAnonymousRequests, trackStoredSession } from './session-guard'

const ANON_KEY = 'sb_publishable_test'
const REST = 'https://project.supabase.co/rest/v1/expenses?select=*'

function headers(authorization?: string): Headers {
  const h = new Headers({ apikey: ANON_KEY })
  if (authorization) {
    h.set('Authorization', authorization)
  }
  return h
}

function setup(signedIn: boolean) {
  const baseFetch = jest.fn().mockResolvedValue(new Response('[]'))
  const guarded = guardAnonymousRequests(baseFetch, ANON_KEY, () => signedIn)
  return { baseFetch, guarded }
}

describe('guardAnonymousRequests', () => {
  it('refuses a data request carrying only the anon key while a user is signed in', async () => {
    const { baseFetch, guarded } = setup(true)

    await expect(guarded(REST, { headers: headers(`Bearer ${ANON_KEY}`) })).rejects.toThrow(
      'session unavailable',
    )
    expect(baseFetch).not.toHaveBeenCalled()
  })

  it('refuses a data request with no Authorization header while a user is signed in', async () => {
    const { baseFetch, guarded } = setup(true)

    await expect(
      guarded('https://project.supabase.co/functions/v1/copilot', { headers: headers() }),
    ).rejects.toThrow('session unavailable')
    expect(baseFetch).not.toHaveBeenCalled()
  })

  it('sends a request that carries the user token', async () => {
    const { baseFetch, guarded } = setup(true)

    await guarded(REST, { headers: headers('Bearer user.jwt.token') })

    expect(baseFetch).toHaveBeenCalledTimes(1)
  })

  // The refresh call itself is anonymous: blocking it would keep the session from ever recovering.
  it('lets auth requests through', async () => {
    const { baseFetch, guarded } = setup(true)

    await guarded('https://project.supabase.co/auth/v1/token?grant_type=refresh_token', {
      headers: headers(),
    })

    expect(baseFetch).toHaveBeenCalledTimes(1)
  })

  it('lets anonymous requests through once signed out', async () => {
    const { baseFetch, guarded } = setup(false)

    await guarded(REST, { headers: headers(`Bearer ${ANON_KEY}`) })

    expect(baseFetch).toHaveBeenCalledTimes(1)
  })
})

describe('trackStoredSession', () => {
  const KEY = 'sb-project-auth-token'

  function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial))
    return {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: async (key: string) => {
        values.delete(key)
      },
    }
  }

  // An expired token that cannot refresh offline makes auth-js report no session while it keeps
  // the stored one: the stored session is the truth the guard must follow.
  it('reports a session as soon as auth reads a stored one', async () => {
    const tracked = trackStoredSession(memoryStorage({ [KEY]: '{"access_token":"x"}' }), KEY)

    expect(tracked.hasSession()).toBe(false)
    await tracked.storage.getItem(KEY)

    expect(tracked.hasSession()).toBe(true)
  })

  it('follows the session through sign-in and sign-out', async () => {
    const tracked = trackStoredSession(memoryStorage(), KEY)

    await tracked.storage.setItem(KEY, '{"access_token":"x"}')
    expect(tracked.hasSession()).toBe(true)

    await tracked.storage.removeItem(KEY)
    expect(tracked.hasSession()).toBe(false)
  })

  it('ignores the other keys auth stores', async () => {
    const tracked = trackStoredSession(memoryStorage(), KEY)

    await tracked.storage.setItem(`${KEY}-code-verifier`, 'verifier')

    expect(tracked.hasSession()).toBe(false)
  })
})
