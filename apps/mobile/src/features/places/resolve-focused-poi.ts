import type { Poi } from './poi.types'

// Resolves a focus deep-link (`?focus=<placeId>`) against the broader interest-union result the
// rail already fetched (an instant TanStack cache hit, since it's the same query key), falling
// back to the grid's active-category result. Pure so the resolution order is unit-testable
// without mounting the activities screen, which has no test harness.
export function resolveFocusedPoi(
  focusId: string,
  unionPois: Poi[] | null | undefined,
  gridPois: Poi[] | null | undefined,
): Poi | null {
  const fromUnion = unionPois?.find((poi) => poi.placeId === focusId)
  if (fromUnion) {
    return fromUnion
  }
  return gridPois?.find((poi) => poi.placeId === focusId) ?? null
}
