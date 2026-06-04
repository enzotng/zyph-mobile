import type { PersistedClient } from '@tanstack/react-query-persist-client'

import { mmkvQueryPersister } from './query-persister'

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>()
  return {
    createMMKV: () => ({
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
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
