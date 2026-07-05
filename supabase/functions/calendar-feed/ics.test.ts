import { buildCalendar, escapeText, foldLine } from './ics'
import type { CalendarEventInput } from './ics'

function baseEvent(overrides: Partial<CalendarEventInput> = {}): CalendarEventInput {
  return {
    id: 'event-1',
    title: 'Museum visit',
    notes: null,
    startsAt: '2026-08-01T10:30:15.000Z',
    endsAt: null,
    lat: null,
    lng: null,
    locationName: null,
    gateLocation: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('escapeText', () => {
  it('escapes a leading backslash before semicolon/comma escaping, so the inserted backslashes are not themselves re-escaped', () => {
    const input = 'a\\;b,c' // literal: a \ ; b , c
    const expected = 'a' + '\\'.repeat(3) + ';b' + '\\' + ',c'
    expect(escapeText(input)).toBe(expected)
  })

  it('escapes semicolons and commas', () => {
    expect(escapeText('Room 3; Building A, wing 2')).toBe('Room 3\\; Building A\\, wing 2')
  })

  it('turns CRLF, lone CR and lone LF into the literal \\n escape sequence', () => {
    expect(escapeText('line1\r\nline2\rline3\nline4')).toBe('line1\\nline2\\nline3\\nline4')
  })
})

describe('foldLine', () => {
  it('leaves a line within the 75-octet budget unfolded', () => {
    const line = 'X'.repeat(75)
    expect(foldLine(line)).toBe(line)
  })

  it('folds a line one octet over the budget into a continuation starting with a space', () => {
    const line = 'X'.repeat(76)
    expect(foldLine(line)).toBe(`${'X'.repeat(75)}\r\n X`)
  })

  it('backs a fold cut off a UTF-8 continuation byte so an accented character is never split across lines', () => {
    // 72 ASCII bytes + "Ch" lands the multi-byte "â" so its first byte sits at octet 74 and its
    // continuation byte at octet 75 - exactly on the naive cut point.
    const title = `${'X'.repeat(72)}Château de Chambord`
    const folded = foldLine(title)
    const [first, second] = folded.split('\r\n ')

    expect(new TextEncoder().encode(first).length).toBeLessThanOrEqual(75)
    expect(first).toBe(`${'X'.repeat(72)}Ch`)
    expect(second.startsWith('âteau')).toBe(true)
    expect(folded).not.toContain('�')
    expect(first + second).toBe(title)
  })
})

describe('buildCalendar', () => {
  it('wraps events in a VCALENDAR with the expected header fields, escaping the trip title in X-WR-CALNAME', () => {
    const ics = buildCalendar({ tripTitle: 'Trip, Planning; 2026', events: [] })

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0\r\n')
    expect(ics).toContain('X-WR-CALNAME:ZYPH - Trip\\, Planning\\; 2026\r\n')
  })

  it('produces a valid calendar with no VEVENT block when there are no events', () => {
    const ics = buildCalendar({ tripTitle: 'Empty trip', events: [] })

    expect(ics).not.toContain('BEGIN:VEVENT')
    expect(ics).not.toContain('END:VEVENT')
  })

  it('pairs BEGIN:VEVENT/END:VEVENT once per event and converts DTSTART to UTC basic format', () => {
    const events = [
      baseEvent({ id: 'a' }),
      baseEvent({ id: 'b', startsAt: '2026-12-31T23:59:00.000Z' }),
    ]
    const ics = buildCalendar({ tripTitle: 'Trip', events })

    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART:20260801T103015Z')
    expect(ics).toContain('DTSTART:20261231T235900Z')
  })

  it('sets DTEND from endsAt when provided', () => {
    const ics = buildCalendar({
      tripTitle: 'Trip',
      events: [baseEvent({ endsAt: '2026-08-01T12:00:00.000Z' })],
    })

    expect(ics).toContain('DTEND:20260801T120000Z')
  })

  it('defaults DTEND to startsAt + 1 hour when endsAt is absent', () => {
    const ics = buildCalendar({
      tripTitle: 'Trip',
      events: [baseEvent({ startsAt: '2026-08-01T10:00:00.000Z', endsAt: null })],
    })

    expect(ics).toContain('DTEND:20260801T110000Z')
  })

  it('includes a -PT1H VALARM for every event', () => {
    const ics = buildCalendar({ tripTitle: 'Trip', events: [baseEvent()] })

    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics).toContain('END:VALARM')
  })

  describe('LOCATION fallback chain', () => {
    it('uses locationName when present', () => {
      const ics = buildCalendar({
        tripTitle: 'Trip',
        events: [baseEvent({ locationName: 'Louvre Museum', gateLocation: { label: 'Gate 12' } })],
      })

      expect(ics).toContain('LOCATION:Louvre Museum')
    })

    it('falls back to the gate label when locationName is absent', () => {
      const ics = buildCalendar({
        tripTitle: 'Trip',
        events: [baseEvent({ locationName: null, gateLocation: { label: 'Gate 12' } })],
      })

      expect(ics).toContain('LOCATION:Gate 12')
    })

    it('omits LOCATION when neither is present', () => {
      const ics = buildCalendar({
        tripTitle: 'Trip',
        events: [baseEvent({ locationName: null, gateLocation: null })],
      })

      expect(ics).not.toContain('LOCATION:')
    })

    it('degrades without throwing when gate_location.label is not a string (legacy/hand-edited row)', () => {
      const events = [
        baseEvent({
          locationName: null,
          // biome-ignore lint: exercising a malformed jsonb shape on purpose
          gateLocation: { label: 42 as unknown as string },
        }),
      ]

      expect(() => buildCalendar({ tripTitle: 'Trip', events })).not.toThrow()
      const ics = buildCalendar({ tripTitle: 'Trip', events })
      expect(ics).not.toContain('LOCATION:')
    })
  })

  it('skips a malformed event but keeps rendering its siblings, warning with the offending id', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const events = [
      baseEvent({ id: 'good-1' }),
      // No endsAt: the DTEND fallback (`new Date(NaN).toISOString()`) throws on an unparseable
      // startsAt - the one way buildEvent can actually throw.
      baseEvent({ id: 'bad-event', startsAt: 'garbage', endsAt: null }),
      baseEvent({ id: 'good-2' }),
    ]

    const ics = buildCalendar({ tripTitle: 'Trip', events })

    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('UID:good-1@zyph.app')
    expect(ics).toContain('UID:good-2@zyph.app')
    expect(ics).not.toContain('bad-event')
    expect(warnSpy).toHaveBeenCalledWith('calendar-feed: skipped malformed event', 'bad-event')

    warnSpy.mockRestore()
  })
})
