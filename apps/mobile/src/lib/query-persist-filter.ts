import type { DehydrateOptions, QueryKey } from '@tanstack/react-query'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'

// The persisted cache is plaintext on disk. Matched by exact index, never `includes`:
// key[0] is 'trips' for 13 other families, and place-search's key[2] is user-typed text.
export function isSensitiveQueryKey(queryKey: QueryKey): boolean {
  return (
    queryKey[0] === 'place-search' ||
    queryKey[0] === 'trip-inbox-address' ||
    queryKey[2] === 'member-locations'
  )
}

export const persistDehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) && !isSensitiveQueryKey(query.queryKey),
  // Defensive, and a no-op today: mutations dehydrate only while isPaused, which never
  // happens under networkMode 'offlineFirst' with retry 0. Giving mutations a retry would
  // silently start writing their variables - which carry raw GPS - to the plaintext store.
  shouldDehydrateMutation: () => false,
}
