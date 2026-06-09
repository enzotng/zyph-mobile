import { useQuery } from '@tanstack/react-query'

import { getTripWeather } from '../api/weather.api'

type WeatherTrip = {
  id: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  latitude: number | null
  longitude: number | null
}

export function tripWeatherQueryKey(
  tripId: string,
  today: string,
  destination: string,
  latitude: number | null,
  longitude: number | null,
) {
  return ['weather', tripId, today, destination, latitude, longitude] as const
}

// Local calendar date (YYYY-MM-DD), not UTC, so the date-window math and the daily cache key
// align with the user's day rather than rolling over at UTC midnight.
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Fetches the destination forecast for a trip. Disabled until the trip has a destination. staleTime
// is 1h and the day in the key guarantees a fresh fetch each calendar day; gcTime keeps the entry
// (and the persisted cache) resident across dashboard revisits within the day. Returns null (place
// not found) without erroring so the card can simply hide.
export function useTripWeather(trip: WeatherTrip | undefined) {
  const today = localToday()
  const destination = trip?.destination?.trim() ?? ''
  const latitude = trip?.latitude ?? null
  const longitude = trip?.longitude ?? null
  return useQuery({
    queryKey: tripWeatherQueryKey(trip?.id ?? '', today, destination, latitude, longitude),
    queryFn: () =>
      getTripWeather(
        destination,
        trip?.start_date ?? null,
        trip?.end_date ?? null,
        today,
        latitude,
        longitude,
      ),
    enabled: Boolean(trip?.id) && destination.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
