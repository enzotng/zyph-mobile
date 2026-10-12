export const SESSION_UNAVAILABLE = 'session unavailable'

const DATA_PATHS = ['/rest/v1/', '/functions/v1/', '/storage/v1/']

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

// Whether a session is stored, as auth-js itself sees it. Its auth events are no substitute: on a
// cold start offline with an expired token it reports no session while keeping the stored one.
export function trackStoredSession(base: AuthStorage, sessionKey: string) {
  let stored = false
  const storage: AuthStorage = {
    getItem: async (key) => {
      const value = await base.getItem(key)
      if (key === sessionKey) {
        stored = value !== null
      }
      return value
    },
    setItem: async (key, value) => {
      await base.setItem(key, value)
      if (key === sessionKey) {
        stored = true
      }
    },
    removeItem: async (key) => {
      await base.removeItem(key)
      if (key === sessionKey) {
        stored = false
      }
    },
  }
  return { storage, hasSession: () => stored }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  return input instanceof URL ? input.href : input.url
}

// Since auth-js 2.108, a refresh that fails - offline included - blocks the refresh token for a
// minute, and data requests in that window go out with the anon key alone. RLS answers those with
// empty lists that would overwrite the cached data, so while a user is signed in an anonymous data
// request is refused instead. Auth requests always pass: the refresh itself is anonymous.
export function guardAnonymousRequests(
  baseFetch: typeof fetch,
  anonKey: string,
  isSignedIn: () => boolean,
): typeof fetch {
  return (input, init) => {
    const url = requestUrl(input)
    if (isSignedIn() && DATA_PATHS.some((path) => url.includes(path))) {
      const authorization = new Headers(init?.headers).get('Authorization')
      if (!authorization || authorization === `Bearer ${anonKey}`) {
        return Promise.reject(new Error(SESSION_UNAVAILABLE))
      }
    }
    return baseFetch(input, init)
  }
}
