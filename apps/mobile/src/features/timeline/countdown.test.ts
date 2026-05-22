import { eventStatus, formatCountdown } from './countdown'

const NOW = new Date('2026-05-22T12:00:00Z').getTime()
const iso = (d: string) => new Date(d).toISOString()

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
  it('shows days and hours', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 3, hours: 4, minutes: 30 })).toBe('in 3d 4h')
  })

  it('shows hours and minutes when under a day', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 4, minutes: 12 })).toBe('in 4h 12m')
  })

  it('shows minutes when under an hour', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 0, minutes: 12 })).toBe('in 12m')
  })

  it('shows "starting now" when imminent', () => {
    expect(formatCountdown({ kind: 'upcoming', days: 0, hours: 0, minutes: 0 })).toBe(
      'starting now',
    )
  })
})
