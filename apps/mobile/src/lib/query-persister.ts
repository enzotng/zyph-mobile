import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client'

import { persistDehydrateOptions } from './query-persist-filter'
import { openEncryptedMMKV } from './storage-encryption'

// Synchronous MMKV-backed persister for the react-query cache: the last-known trip data
// (trips, events, balances, members) is restored instantly on launch, so the app is usable
// with no network. MMKV is synchronous, so there is no async I/O on the hot path.
const storage = openEncryptedMMKV('zyph-query-cache', { discardExisting: true })
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
    // Asks MMKV to shrink the file; a no-op while it still fits in one page. NOT a secure
    // erase: MMKV only zero-fills on growth, so truncated blocks keep their old bytes
    // until the filesystem reuses them.
    storage.trim()
  },
}

export const queryPersistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: mmkvQueryPersister,
  // Drop cached data older than 7 days; bump the buster to invalidate on a shape change.
  maxAge: 1000 * 60 * 60 * 24 * 7,
  buster: 'v2',
  dehydrateOptions: persistDehydrateOptions,
}
