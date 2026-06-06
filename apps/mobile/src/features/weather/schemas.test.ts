import { conditionIcon, resolveForecastRange, weatherCodeToCondition } from './schemas'

describe('weatherCodeToCondition', () => {
  it('maps WMO codes to coarse conditions', () => {
    expect(weatherCodeToCondition(0)).toBe('clear')
    expect(weatherCodeToCondition(1)).toBe('clear')
    expect(weatherCodeToCondition(2)).toBe('cloudy')
    expect(weatherCodeToCondition(3)).toBe('cloudy')
    expect(weatherCodeToCondition(45)).toBe('fog')
    expect(weatherCodeToCondition(48)).toBe('fog')
    expect(weatherCodeToCondition(61)).toBe('rain')
    expect(weatherCodeToCondition(80)).toBe('rain')
    expect(weatherCodeToCondition(71)).toBe('snow')
    expect(weatherCodeToCondition(77)).toBe('snow')
    expect(weatherCodeToCondition(86)).toBe('snow')
    expect(weatherCodeToCondition(95)).toBe('storm')
    expect(weatherCodeToCondition(99)).toBe('storm')
  })
})

describe('conditionIcon', () => {
  it('maps each condition to a glyph', () => {
    expect(conditionIcon('clear')).toBe('sunny-outline')
    expect(conditionIcon('cloudy')).toBe('cloudy-outline')
    expect(conditionIcon('fog')).toBe('cloud-outline')
    expect(conditionIcon('snow')).toBe('snow-outline')
    expect(conditionIcon('storm')).toBe('thunderstorm-outline')
    expect(conditionIcon('rain')).toBe('rainy-outline')
  })
})

describe('resolveForecastRange', () => {
  const today = '2026-06-06'

  it('falls back to outlook when there is no start date', () => {
    expect(resolveForecastRange(null, null, today)).toEqual({ mode: 'outlook' })
  })

  it('uses the trip dates when they fall in the window', () => {
    expect(resolveForecastRange('2026-06-10', '2026-06-15', today)).toEqual({
      mode: 'trip',
      start: '2026-06-10',
      end: '2026-06-15',
    })
  })

  it('clamps a start in the past to today', () => {
    expect(resolveForecastRange('2026-06-01', '2026-06-10', today)).toEqual({
      mode: 'trip',
      start: '2026-06-06',
      end: '2026-06-10',
    })
  })

  it('clamps an end beyond the 16-day horizon', () => {
    expect(resolveForecastRange('2026-06-10', '2026-06-30', today)).toEqual({
      mode: 'trip',
      start: '2026-06-10',
      end: '2026-06-22',
    })
  })

  it('falls back to outlook for a far-future trip', () => {
    expect(resolveForecastRange('2026-07-15', '2026-07-20', today)).toEqual({ mode: 'outlook' })
  })

  it('falls back to outlook for a past trip', () => {
    expect(resolveForecastRange('2026-05-01', '2026-05-10', today)).toEqual({ mode: 'outlook' })
  })
})
