import {
  type ForecastDay,
  type ForecastRange,
  forecastResponseSchema,
  type GeocodeResult,
  geocodeResponseSchema,
  resolveForecastRange,
  type TripWeather,
  weatherCodeToCondition,
} from '../schemas'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

// -0 from Math.round (e.g. -0.4°C) stringifies as "-0"; coerce it to 0.
function roundTemp(value: number): number {
  return Math.round(value) || 0
}

// Resolves a free-text destination to coordinates via Open-Meteo geocoding (no key). Returns
// null when the place can't be found (or the payload is malformed), so the caller can simply
// hide the weather card.
export async function geocodeDestination(name: string): Promise<GeocodeResult | null> {
  const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1&format=json`)
  if (!res.ok) {
    throw new Error(`geocoding failed (${res.status})`)
  }
  const parsed = geocodeResponseSchema.safeParse(await res.json())
  const first = parsed.success ? parsed.data.results?.[0] : undefined
  if (!first) {
    return null
  }
  return {
    lat: first.latitude,
    lng: first.longitude,
    label: first.country ? `${first.name}, ${first.country}` : first.name,
  }
}

// Daily forecast at a coordinate. A 'trip' range requests the trip's own dates; otherwise a
// 7-day outlook.
export async function fetchForecast(
  lat: number,
  lng: number,
  range: ForecastRange,
): Promise<ForecastDay[]> {
  const base =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto'
  const url =
    range.mode === 'trip' && range.start && range.end
      ? `${base}&start_date=${range.start}&end_date=${range.end}`
      : `${base}&forecast_days=7`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`forecast failed (${res.status})`)
  }
  const parsed = forecastResponseSchema.safeParse(await res.json())
  const daily = parsed.success ? parsed.data.daily : undefined
  if (!daily) {
    return []
  }
  return daily.time.map((date, i) => ({
    date,
    condition: weatherCodeToCondition(daily.weather_code[i] ?? 0),
    tempMaxC: roundTemp(daily.temperature_2m_max[i] ?? 0),
    tempMinC: roundTemp(daily.temperature_2m_min[i] ?? 0),
  }))
}

// Geocodes the destination then fetches the forecast for the trip dates (or a 7-day outlook).
// `today` is passed in ('YYYY-MM-DD') so the date-window logic stays deterministic/testable.
export async function getTripWeather(
  destination: string,
  startDate: string | null,
  endDate: string | null,
  today: string,
): Promise<TripWeather | null> {
  const geo = await geocodeDestination(destination)
  if (!geo) {
    return null
  }
  const range = resolveForecastRange(startDate, endDate, today)
  const days = await fetchForecast(geo.lat, geo.lng, range)
  return { place: geo.label, mode: range.mode, days }
}
