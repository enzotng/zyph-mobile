import type { DehydrateOptions, QueryKey } from '@tanstack/react-query'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'

// These families never reach disk at all - a stronger guarantee than the at-rest encryption
// underneath, since query-persister's trim() is not a secure erase and residual blocks survive
// until the filesystem reuses them. Matched by exact index, never `includes`: key[0] is 'trips'
// for 13 other families, and place-search's key[2] is user-typed text.
export function isSensitiveQueryKey(queryKey: QueryKey): boolean {
  return (
    queryKey[0] === 'place-search' ||
    // Holds myStatus, which decides whether the claim screen may offer named places at all, plus
    // an invite code and other members' first names. A restored copy would answer for a
    // membership that has since changed.
    queryKey[0] === 'trip-claim-options' ||
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
