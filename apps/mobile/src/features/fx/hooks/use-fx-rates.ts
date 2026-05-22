import { useQuery } from '@tanstack/react-query'

import { fetchFxRates } from '../api/fx.api'

const TWELVE_HOURS = 1000 * 60 * 60 * 12

export function fxRatesQueryKey() {
  return ['fx-rates'] as const
}

export function useFxRates() {
  return useQuery({
    queryKey: fxRatesQueryKey(),
    queryFn: fetchFxRates,
    // ECB publishes once per weekday; a half-day cache is plenty and works offline.
    staleTime: TWELVE_HOURS,
    gcTime: TWELVE_HOURS * 14,
  })
}
