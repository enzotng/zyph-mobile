import { parsedEmailEventSchema } from './schemas'

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
})
