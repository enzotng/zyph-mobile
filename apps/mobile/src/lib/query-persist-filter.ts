import type { DehydrateOptions, Query, QueryKey } from '@tanstack/react-query'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'

import { SESSION_UNAVAILABLE } from './session-guard'

// These families never reach disk at all - a stronger guarantee than the at-rest encryption
// underneath, since query-persister's trim() is not a secure erase and residual blocks survive
// until the filesystem reuses them. Matched by exact index, never `includes`: key[0] is 'trips'
// for 13 other families, and place-search's key[2] is user-typed text.
export function isSensitiveQueryKey(queryKey: QueryKey): boolean {
  return (
    queryKey[0] === 'place-search' ||
    queryKey[0] === 'trip-inbox-address' ||
    queryKey[2] === 'member-locations'
  )
}

// A refetch the session guard refused leaves its query in error with the data intact; dropping it
// from disk would empty the screen on the next cold start offline.
function isRefusedRefetchWithData(query: Query): boolean {
  const message = (query.state.error as { message?: unknown } | null)?.message
  return (
    query.state.data !== undefined &&
    typeof message === 'string' &&
    message.includes(SESSION_UNAVAILABLE)
  )
}

export const persistDehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) =>
    (defaultShouldDehydrateQuery(query) || isRefusedRefetchWithData(query)) &&
    !isSensitiveQueryKey(query.queryKey),
  // Unconditional on purpose: mutation variables carry raw GPS and must stay off disk whatever
  // retry setting the client is given. Do not relax this to a condition on the current config.
  shouldDehydrateMutation: () => false,
}
