import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { createMMKV } from 'react-native-mmkv'

// Synchronous MMKV-backed persister for the react-query cache: the last-known trip data
// (trips, events, balances, members) is restored instantly on launch, so the app is usable
// with no network. MMKV is synchronous, so there is no async I/O on the hot path.
const storage = createMMKV({ id: 'zyph-query-cache' })
const CACHE_KEY = 'react-query'

export const mmkvQueryPersister: Persister = {
  persistClient(client: PersistedClient) {
    storage.set(CACHE_KEY, JSON.stringify(client))
  },
  restoreClient() {
    const raw = storage.getString(CACHE_KEY)
    return raw ? (JSON.parse(raw) as PersistedClient) : undefined
  },
  removeClient() {
    storage.remove(CACHE_KEY)
  },
}
