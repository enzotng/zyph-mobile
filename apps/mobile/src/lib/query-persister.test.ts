import { dehydrate, QueryClient } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/react-query-persist-client'

import { mmkvQueryPersister, queryPersistOptions } from './query-persister'

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>()
  return {
    createMMKV: () => ({
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
      trim: () => undefined,
    }),
  }
})

const client: PersistedClient = {
  timestamp: 1,
  buster: 'v1',
  clientState: { mutations: [], queries: [] },
}

beforeEach(async () => {
  await mmkvQueryPersister.removeClient()
})

describe('mmkvQueryPersister', () => {
  it('round-trips persist then restore', async () => {
    await mmkvQueryPersister.persistClient(client)
    expect(await mmkvQueryPersister.restoreClient()).toEqual(client)
  })

  it('returns undefined after remove', async () => {
    await mmkvQueryPersister.persistClient(client)
    await mmkvQueryPersister.removeClient()
    expect(await mmkvQueryPersister.restoreClient()).toBeUndefined()
  })

  it('returns undefined when nothing is stored', async () => {
    expect(await mmkvQueryPersister.restoreClient()).toBeUndefined()
  })
})

describe('queryPersistOptions', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('filters member GPS out of what the provider would persist', async () => {
    await queryClient.prefetchQuery({
      queryKey: ['trips', 'trip-1', 'member-locations'],
      queryFn: () => [{ lat: 48.8566, lng: 2.3522 }],
    })
    await queryClient.prefetchQuery({
      queryKey: ['trips', 'trip-1', 'expenses'],
      queryFn: () => [{ id: 'expense-1' }],
    })

    const keys = dehydrate(queryClient, queryPersistOptions.dehydrateOptions).queries.map(
      (query) => query.queryKey,
    )
    expect(keys).toContainEqual(['trips', 'trip-1', 'expenses'])
    expect(keys).not.toContainEqual(['trips', 'trip-1', 'member-locations'])
  })

  it('busts caches written before the filter shipped', () => {
    expect(queryPersistOptions.buster).toBe('v2')
  })
})
