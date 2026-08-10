import type { DehydrateOptions, QueryKey } from '@tanstack/react-query'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'

// These families never reach disk. That is the real guarantee, not the at-rest encryption
// underneath it: query-persister's trim() is not a secure erase, so anything once written stays
// recoverable. Matched by exact index, never `includes`: key[0] is 'trips' for 13 other
// families, and place-search's key[2] is user-typed text.
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
  // Unconditional on purpose: mutation variables carry raw GPS and must stay off disk whatever
  // retry setting the client is given. Do not relax this to a condition on the current config.
  shouldDehydrateMutation: () => false,
}
