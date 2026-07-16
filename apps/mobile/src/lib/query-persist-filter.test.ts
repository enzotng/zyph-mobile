import type { QueryKey } from '@tanstack/react-query'
import { dehydrate, QueryClient } from '@tanstack/react-query'

import { placeSearchQueryKey } from '@/features/places/hooks/use-places'
import { tripInboxAddressQueryKey } from '@/features/trips/hooks/use-trips'
import { memberLocationsQueryKey } from '@/features/wayfinder/hooks/use-wayfinder'
import { isSensitiveQueryKey, persistDehydrateOptions } from './query-persist-filter'

jest.mock('@/lib/supabase')

const TRIP_ID = 'e6b3f6a2-0000-4000-8000-000000000001'

describe('isSensitiveQueryKey', () => {
  it('excludes member GPS locations', () => {
    expect(isSensitiveQueryKey(['trips', TRIP_ID, 'member-locations'])).toBe(true)
  })

  it('excludes place-search type-ahead results', () => {
    expect(isSensitiveQueryKey(['place-search', 'fr', 'gare de lyon'])).toBe(true)
  })

  it('excludes the trip inbox address', () => {
    expect(isSensitiveQueryKey(['trip-inbox-address', TRIP_ID])).toBe(true)
  })

  const persistedFamilies: [string, QueryKey][] = [
    ['trips list', ['trips']],
    ['trip detail', ['trips', TRIP_ID]],
    ['events', ['trips', TRIP_ID, 'events']],
    ['expenses', ['trips', TRIP_ID, 'expenses']],
    ['balances', ['trips', TRIP_ID, 'balances']],
    ['expense shares', ['trips', TRIP_ID, 'expense-shares']],
    ['members', ['trips', TRIP_ID, 'members']],
    ['packing', ['trips', TRIP_ID, 'packing']],
    ['settlements', ['trips', TRIP_ID, 'settlements']],
    ['documents', ['trips', TRIP_ID, 'documents']],
    ['trip pois', ['trips', TRIP_ID, 'pois']],
    ['poi detail', ['pois', 'poi-1']],
  ]

  it.each(persistedFamilies)('keeps %s persisted', (_label, queryKey) => {
    expect(isSensitiveQueryKey(queryKey)).toBe(false)
  })

  it('keeps member-names, which only differs from member-locations by suffix', () => {
    expect(isSensitiveQueryKey(['trips', TRIP_ID, 'member-names'])).toBe(false)
  })

  it('ignores a sensitive family name typed into a search field', () => {
    expect(isSensitiveQueryKey(['trips', TRIP_ID, 'events', 'member-locations'])).toBe(false)
  })

  it('ignores a sensitive family name appearing as a trip id', () => {
    expect(isSensitiveQueryKey(['trips', 'place-search', 'expenses'])).toBe(false)
  })

  describe('tracks the real query-key factories', () => {
    it('matches what memberLocationsQueryKey produces', () => {
      expect(isSensitiveQueryKey(memberLocationsQueryKey(TRIP_ID))).toBe(true)
    })

    it('matches what placeSearchQueryKey produces', () => {
      expect(isSensitiveQueryKey(placeSearchQueryKey('gare de lyon', 'fr'))).toBe(true)
    })

    it('matches what tripInboxAddressQueryKey produces', () => {
      expect(isSensitiveQueryKey(tripInboxAddressQueryKey(TRIP_ID))).toBe(true)
    })
  })
})

describe('persistDehydrateOptions', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      // MutationCache.clear() never destroys its mutations, so a finite gcTime leaves a
      // timer behind and jest, which CI runs without --forceExit, never exits.
      defaultOptions: { queries: { retry: false }, mutations: { gcTime: Infinity } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('still refuses to dehydrate an errored query', async () => {
    await queryClient.prefetchQuery({
      queryKey: ['trips', TRIP_ID, 'events'],
      queryFn: () => Promise.reject(new Error('offline')),
    })

    expect(dehydrate(queryClient, persistDehydrateOptions).queries).toHaveLength(0)
  })

  it('never dehydrates a paused mutation, whose variables would carry raw GPS', async () => {
    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async (vars: { lat: number }) => vars })
    mutation.state.isPaused = true
    mutation.state.variables = { lat: 48.8566 }

    expect(dehydrate(queryClient, persistDehydrateOptions).mutations).toHaveLength(0)
  })
})
