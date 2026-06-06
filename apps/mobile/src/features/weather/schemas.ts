import { z } from 'zod'

// Open-Meteo trip weather: geocode the trip destination, then fetch a daily forecast. Free,
// no API key, no auth. WMO weather codes are mapped to a small set of conditions for icons/copy.

// Untrusted third-party payloads validated at the boundary (like features/places).
export const geocodeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
        country: z.string().optional(),
      }),
    )
    .optional(),
})

export const forecastResponseSchema = z.object({
  daily: z
    .object({
      time: z.array(z.string()),
      weather_code: z.array(z.number()),
      temperature_2m_max: z.array(z.number()),
      temperature_2m_min: z.array(z.number()),
    })
    .optional(),
})

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export type ForecastDay = {
  date: string
  condition: WeatherCondition
  tempMaxC: number
  tempMinC: number
}

export type GeocodeResult = {
  lat: number
  lng: number
  label: string
}

// 'trip' = the forecast covers the trip's own dates; 'outlook' = a generic next-days forecast
// at the destination (trip too far out / in the past for the ~16-day forecast window).
export type TripWeather = {
  place: string
  mode: 'trip' | 'outlook'
  days: ForecastDay[]
}

// Maps a WMO weather code (https://open-meteo.com/en/docs) to a coarse condition.
export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code <= 1) {
    return 'clear'
  }
  if (code <= 3) {
    return 'cloudy'
  }
  if (code === 45 || code === 48) {
    return 'fog'
  }
  if (code >= 71 && code <= 77) {
    return 'snow'
  }
  if (code === 85 || code === 86) {
    return 'snow'
  }
  if (code >= 95) {
    return 'storm'
  }
  return 'rain'
}

// Ionicons glyph for a condition.
export function conditionIcon(condition: WeatherCondition): string {
  switch (condition) {
    case 'clear':
      return 'sunny-outline'
    case 'cloudy':
      return 'cloudy-outline'
    case 'fog':
      return 'cloud-outline'
    case 'snow':
      return 'snow-outline'
    case 'storm':
      return 'thunderstorm-outline'
    default:
      return 'rainy-outline'
  }
}

export type ForecastRange = { mode: 'trip' | 'outlook'; start?: string; end?: string }

const FORECAST_HORIZON_DAYS = 16

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Decides whether to request the trip's own dates (when they overlap the ~16-day forecast
// window) or fall back to a generic next-days outlook. All inputs are 'YYYY-MM-DD' strings,
// so lexical comparison is chronological.
export function resolveForecastRange(
  startDate: string | null,
  endDate: string | null,
  today: string,
): ForecastRange {
  if (!startDate) {
    return { mode: 'outlook' }
  }
  const horizon = addDays(today, FORECAST_HORIZON_DAYS)
  const end = endDate ?? startDate
  // Trip overlaps the window if it starts on/before the horizon and ends on/after today.
  if (startDate <= horizon && end >= today) {
    return {
      mode: 'trip',
      start: startDate < today ? today : startDate,
      end: end > horizon ? horizon : end,
    }
  }
  return { mode: 'outlook' }
}
