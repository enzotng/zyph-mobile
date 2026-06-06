export { fetchForecast, geocodeDestination, getTripWeather } from './api/weather.api'
export { WeatherCard } from './components/weather-card'
export { tripWeatherQueryKey, useTripWeather } from './hooks/use-weather'
export {
  conditionIcon,
  type ForecastDay,
  type ForecastRange,
  type GeocodeResult,
  resolveForecastRange,
  type TripWeather,
  type WeatherCondition,
  weatherCodeToCondition,
} from './schemas'
