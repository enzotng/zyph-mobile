import type { TFunction } from 'i18next'
import { eventStatus, formatCountdown } from './countdown'

const NOW = new Date('2026-05-22T12:00:00Z').getTime()
const iso = (d: string) => new Date(d).toISOString()

// formatCountdown is now i18n-aware; the mock t echoes the chosen key so we can
// assert which unit branch (and therefore which locale key) is selected.
const t = ((key: string) => key) as unknown as TFunction

describe('eventStatus', () => {
  it('returns undated when there is no start', () => {
    expect(eventStatus(null, null, NOW)).toEqual({ kind: 'undated' })
  })

  it('counts down days/hours/minutes for a future event', () => {
    expect(eventStatus(iso('2026-05-25T15:30:00Z'), null, NOW)).toEqual({
      kind: 'upcoming',
      days: 3,
      hours: 3,
      minutes: 30,
    })
  })

  it('is in_progress between start and end', () => {
    const status = eventStatus(iso('2026-05-22T11:00:00Z'), iso('2026-05-22T13:00:00Z'), NOW)
    expect(status).toEqual({ kind: 'in_progress' })
  })

  it('is completed once a point event has started', () => {
    expect(eventStatus(iso('2026-05-22T11:59:00Z'), null, NOW)).toEqual({ kind: 'completed' })
  })

  it('is completed after the end time', () => {
    const status = eventStatus(iso('2026-05-22T09:00:00Z'), iso('2026-05-22T10:00:00Z'), NOW)
    expect(status).toEqual({ kind: 'completed' })
  })
})

describe('formatCountdown', () => {
  it('uses the days+hours key when days remain', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 3, hours: 4, minutes: 30 }, t)).toBe(
      'countdown.inDaysHours',
    )
  })

  it('uses the hours+minutes key when under a day', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 4, minutes: 12 }, t)).toBe(
      'countdown.inHoursMinutes',
    )
  })

  it('uses the minutes key when under an hour', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 0, minutes: 12 }, t)).toBe(
      'countdown.inMinutes',
    )
  })

  it('uses the "now" key when imminent', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 0, minutes: 0 }, t)).toBe(
      'countdown.now',
    )
  })
})
