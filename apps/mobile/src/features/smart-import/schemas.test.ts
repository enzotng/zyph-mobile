import { parsedEmailEventSchema, parseEmailResponseSchema } from './schemas'

const base = {
  type: 'flight',
  title: 'AF1234',
  startsAt: '2026-03-15T14:30:00Z',
  endsAt: null,
  location: null,
  gateLocation: null,
  notes: null,
  currency: 'EUR',
  priceCents: 12000,
  confidence: 0.9,
}

describe('parsedEmailEventSchema', () => {
  it('parses a well-formed event', () => {
    const result = parsedEmailEventSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.confidence).toBe(0.9)
      expect(result.data.priceCents).toBe(12000)
    }
  })

  it('coerces a 0-100 confidence onto the 0-1 scale', () => {
    expect(parsedEmailEventSchema.parse({ ...base, confidence: 95 }).confidence).toBeCloseTo(0.95)
  })

  it('clamps an out-of-range confidence to 0', () => {
    expect(parsedEmailEventSchema.parse({ ...base, confidence: -2 }).confidence).toBe(0)
  })

  it('drops a non-integer price instead of rejecting the event', () => {
    expect(parsedEmailEventSchema.parse({ ...base, priceCents: 10.5 }).priceCents).toBeNull()
  })

  it('falls back to "event" for an unknown type', () => {
    expect(parsedEmailEventSchema.parse({ ...base, type: 'meal' }).type).toBe('event')
  })

  it('accepts an event with missing keys, normalizing them to null', () => {
    // The 8B model sometimes OMITS keys instead of emitting null despite the prompt
    // (seen on device: gateLocation/notes/currency absent -> the whole parse blew up).
    const { gateLocation: _g, notes: _n, currency: _c, ...withoutKeys } = base
    const result = parsedEmailEventSchema.safeParse(withoutKeys)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.gateLocation).toBeNull()
      expect(result.data.notes).toBeNull()
      expect(result.data.currency).toBeNull()
    }
  })

  it('accepts a minimal payload where every varying field is absent', () => {
    const result = parsedEmailEventSchema.safeParse({ type: 'flight', confidence: 0.4 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBeNull()
      expect(result.data.startsAt).toBeNull()
      expect(result.data.endsAt).toBeNull()
      expect(result.data.location).toBeNull()
      expect(result.data.priceCents).toBeNull()
    }
  })

  it('degrades a wrong-typed field to null instead of rejecting the event', () => {
    expect(parsedEmailEventSchema.parse({ ...base, notes: 42 }).notes).toBeNull()
    expect(parsedEmailEventSchema.parse({ ...base, currency: ['EUR'] }).currency).toBeNull()
  })

  it('degrades a malformed location object to null', () => {
    expect(parsedEmailEventSchema.parse({ ...base, location: { lat: 1 } }).location).toBeNull()
    expect(
      parsedEmailEventSchema.parse({ ...base, gateLocation: { label: 7, lat: 1, lng: 2 } })
        .gateLocation,
    ).toBeNull()
  })

  it('normalizes endLocation: absent or malformed -> null, valid arrival kept', () => {
    // `base` has no endLocation key at all - the older edge omits it entirely.
    expect(parsedEmailEventSchema.parse(base).endLocation).toBeNull()
    expect(
      parsedEmailEventSchema.parse({ ...base, endLocation: { lat: 55.6 } }).endLocation,
    ).toBeNull()
    const arrival = { name: 'Oslo Airport', lat: 60.1976, lng: 11.1004 }
    expect(parsedEmailEventSchema.parse({ ...base, endLocation: arrival }).endLocation).toEqual(
      arrival,
    )
  })
})

describe('parseEmailResponseSchema', () => {
  it('accepts an events array (items validated separately)', () => {
    const result = parseEmailResponseSchema.safeParse({ events: [base, { junk: true }] })
    expect(result.success).toBe(true)
  })

  it('accepts an empty events list', () => {
    expect(parseEmailResponseSchema.safeParse({ events: [] }).success).toBe(true)
  })

  it('rejects a non-array events and a missing envelope', () => {
    expect(parseEmailResponseSchema.safeParse({ events: 'nope' }).success).toBe(false)
    expect(parseEmailResponseSchema.safeParse('garbage').success).toBe(false)
  })

  it('rejects a list longer than the 10-event server cap (defense in depth)', () => {
    const events = Array.from({ length: 11 }, () => ({ ...base }))
    expect(parseEmailResponseSchema.safeParse({ events }).success).toBe(false)
    expect(parseEmailResponseSchema.safeParse({ events: events.slice(0, 10) }).success).toBe(true)
  })
})
