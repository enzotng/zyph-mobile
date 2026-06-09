import { fetchForecast, geocodeDestination, getTripWeather } from './weather.api'

const mockFetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

function ok(json: unknown): Response {
  return { ok: true, json: async () => json } as Response
}
function notOk(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as Response
}

describe('geocodeDestination', () => {
  it('returns the first result with a country-qualified label', async () => {
    mockFetch.mockResolvedValue(
      ok({ results: [{ latitude: 38.7, longitude: -9.1, name: 'Lisbon', country: 'Portugal' }] }),
    )
    await expect(geocodeDestination('Lisbon')).resolves.toEqual({
      lat: 38.7,
      lng: -9.1,
      label: 'Lisbon, Portugal',
    })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('name=Lisbon'))
  })

  it('returns null when there are no results', async () => {
    mockFetch.mockResolvedValue(ok({}))
    await expect(geocodeDestination('Nowhere')).resolves.toBeNull()
  })

  it('throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue(notOk(500))
    await expect(geocodeDestination('x')).rejects.toThrow('geocoding failed')
  })
})

describe('fetchForecast', () => {
  const daily = {
    time: ['2026-06-10', '2026-06-11'],
    weather_code: [0, 61],
    temperature_2m_max: [25.4, 18.9],
    temperature_2m_min: [15.1, 12.2],
  }

  it('maps daily arrays to rounded forecast days and sends the trip range', async () => {
    mockFetch.mockResolvedValue(ok({ daily }))
    await expect(
      fetchForecast(38.7, -9.1, { mode: 'trip', start: '2026-06-10', end: '2026-06-11' }),
    ).resolves.toEqual([
      { date: '2026-06-10', condition: 'clear', tempMaxC: 25, tempMinC: 15 },
      { date: '2026-06-11', condition: 'rain', tempMaxC: 19, tempMinC: 12 },
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('start_date=2026-06-10&end_date=2026-06-11'),
    )
  })

  it('requests a 7-day outlook when mode is outlook', async () => {
    mockFetch.mockResolvedValue(ok({ daily }))
    await fetchForecast(0, 0, { mode: 'outlook' })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('forecast_days=7'))
  })

  it('returns [] when there is no daily block', async () => {
    mockFetch.mockResolvedValue(ok({}))
    await expect(fetchForecast(0, 0, { mode: 'outlook' })).resolves.toEqual([])
  })

  it('coerces a rounded -0 temperature to 0', async () => {
    mockFetch.mockResolvedValue(
      ok({
        daily: {
          time: ['2026-06-10'],
          weather_code: [0],
          temperature_2m_max: [0.2],
          temperature_2m_min: [-0.4],
        },
      }),
    )
    const [day] = await fetchForecast(0, 0, { mode: 'outlook' })
    expect(Object.is(day.tempMinC, -0)).toBe(false)
    expect(day.tempMinC).toBe(0)
    expect(day.tempMaxC).toBe(0)
  })

  it('throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue(notOk(429))
    await expect(fetchForecast(0, 0, { mode: 'outlook' })).rejects.toThrow('forecast failed')
  })
})

describe('getTripWeather', () => {
  it('returns null when the destination cannot be geocoded', async () => {
    mockFetch.mockResolvedValueOnce(ok({}))
    await expect(
      getTripWeather('Nowhere', null, null, '2026-06-06', null, null),
    ).resolves.toBeNull()
  })

  it('geocodes then forecasts when no coordinates are provided', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ results: [{ latitude: 38.7, longitude: -9.1, name: 'Lisbon', country: 'Portugal' }] }),
      )
      .mockResolvedValueOnce(
        ok({
          daily: {
            time: ['2026-06-10'],
            weather_code: [0],
            temperature_2m_max: [25],
            temperature_2m_min: [15],
          },
        }),
      )
    await expect(
      getTripWeather('Lisbon', '2026-06-10', '2026-06-12', '2026-06-06', null, null),
    ).resolves.toEqual({
      place: 'Lisbon, Portugal',
      mode: 'trip',
      days: [{ date: '2026-06-10', condition: 'clear', tempMaxC: 25, tempMinC: 15 }],
    })
  })

  it('uses provided coordinates and skips geocoding', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        daily: {
          time: ['2026-06-10'],
          weather_code: [0],
          temperature_2m_max: [25],
          temperature_2m_min: [15],
        },
      }),
    )
    await expect(
      getTripWeather('Angers', '2026-06-10', '2026-06-12', '2026-06-06', 47.47, -0.55),
    ).resolves.toEqual({
      place: 'Angers',
      mode: 'trip',
      days: [{ date: '2026-06-10', condition: 'clear', tempMaxC: 25, tempMinC: 15 }],
    })
    // Only the forecast call, no geocoding.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('latitude=47.47'))
  })
})
