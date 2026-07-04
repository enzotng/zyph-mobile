import { supabase } from '@/lib/supabase'

import { parseEmailViaAi } from './smart-import.api'

jest.mock('@/lib/supabase')

const invoke = supabase.functions.invoke as jest.Mock

// A fully valid event matching parsedEmailEventSchema, used as the happy-path base.
const validEvent = {
  type: 'flight' as const,
  title: 'AF1234 Paris -> Rome',
  startsAt: '2026-06-10T08:00:00Z',
  endsAt: '2026-06-10T10:00:00Z',
  location: { name: 'Charles de Gaulle', lat: 49.0097, lng: 2.5479 },
  gateLocation: { label: 'Gate K12', lat: 49.0097, lng: 2.5479 },
  notes: 'Window seat',
  currency: 'EUR',
  priceCents: 12_000,
  confidence: 0.9,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('parseEmailViaAi', () => {
  it('invokes the parser function with the text body and returns the validated events', async () => {
    invoke.mockResolvedValue({ data: { events: [validEvent] }, error: null })

    await expect(parseEmailViaAi('booking confirmation')).resolves.toEqual({
      events: [validEvent],
    })
    expect(invoke).toHaveBeenCalledWith('parse-receipt-email', {
      body: { text: 'booking confirmation' },
    })
  })

  it('throws when the function returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('edge boom') })

    await expect(parseEmailViaAi('whatever')).rejects.toThrow('edge boom')
  })

  it('throws on an empty (null data) response', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(parseEmailViaAi('whatever')).rejects.toThrow('Empty response from the parser.')
  })

  it('falls back to the "event" type when the model returns an unknown type', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, type: 'spaceship' }] },
      error: null,
    })

    const result = await parseEmailViaAi('weird type')

    expect(result.events[0].type).toBe('event')
  })

  it('coerces a non-integer price to null at the zod boundary', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, priceCents: 12.5 }] },
      error: null,
    })

    const result = await parseEmailViaAi('fractional price')

    expect(result.events[0].priceCents).toBeNull()
  })

  it('clamps a 0-100 scale confidence down to the 0-1 range', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, confidence: 75 }] },
      error: null,
    })

    const result = await parseEmailViaAi('percent confidence')

    expect(result.events[0].confidence).toBeCloseTo(0.75)
  })

  it('keeps an already-normalized confidence within the 0-1 range untouched', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, confidence: 0.42 }] },
      error: null,
    })

    const result = await parseEmailViaAi('fraction confidence')

    expect(result.events[0].confidence).toBeCloseTo(0.42)
  })

  it('clamps a negative confidence to 0 and defaults a non-numeric confidence to 0', async () => {
    invoke.mockResolvedValueOnce({
      data: { events: [{ ...validEvent, confidence: -3 }] },
      error: null,
    })
    const negative = await parseEmailViaAi('negative confidence')
    expect(negative.events[0].confidence).toBe(0)

    invoke.mockResolvedValueOnce({
      data: { events: [{ ...validEvent, confidence: 'high' }] },
      error: null,
    })
    const nonNumeric = await parseEmailViaAi('text confidence')
    expect(nonNumeric.events[0].confidence).toBe(0)
  })

  it('accepts null location and gateLocation', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, location: null, gateLocation: null }] },
      error: null,
    })

    const result = await parseEmailViaAi('no location')

    expect(result.events[0].location).toBeNull()
    expect(result.events[0].gateLocation).toBeNull()
  })

  it('degrades a wrong-typed field to null instead of throwing', async () => {
    invoke.mockResolvedValue({
      data: { events: [{ ...validEvent, title: 123 }] },
      error: null,
    })

    const result = await parseEmailViaAi('bad title')

    expect(result.events[0].title).toBeNull()
  })

  it('accepts an event whose optional keys were omitted by the model', async () => {
    // Regression: the 8B model omitted gateLocation/notes/currency for an email that
    // had none of them, and the strict schema turned the whole parse into a raw
    // ZodError alert on device.
    invoke.mockResolvedValue({
      data: { events: [{ type: 'flight', title: 'AF1234', confidence: 0.8 }] },
      error: null,
    })

    const result = await parseEmailViaAi('sparse booking email')

    expect(result.events[0].title).toBe('AF1234')
    expect(result.events[0].gateLocation).toBeNull()
    expect(result.events[0].notes).toBeNull()
    expect(result.events[0].currency).toBeNull()
    expect(result.events[0].location).toBeNull()
    expect(result.events[0].startsAt).toBeNull()
  })

  it('throws when the envelope is garbage (final guard)', async () => {
    invoke.mockResolvedValue({ data: { events: 'nope' }, error: null })
    await expect(parseEmailViaAi('bad envelope')).rejects.toThrow()
  })

  it('keeps a junk object item - every field catch-degrades to null', async () => {
    invoke.mockResolvedValue({
      data: { events: [validEvent, { junk: true }] },
      error: null,
    })
    const result = await parseEmailViaAi('mixed list')
    expect(result.events).toHaveLength(2) // the junk item still parses: every field catch-degrades
  })

  it('returns an empty list when the parser found nothing', async () => {
    invoke.mockResolvedValue({ data: { events: [] }, error: null })
    await expect(parseEmailViaAi('nothing')).resolves.toEqual({ events: [] })
  })

  it('regression: a round-trip email yields two flights with their real dates', async () => {
    // The exact Ryanair BVA<->CPH shape from the 2026-07-04 device report.
    const outbound = {
      ...validEvent,
      title: 'Flight FR9266 BVA -> CPH',
      startsAt: '2026-07-27T08:20:00+02:00',
      endsAt: '2026-07-27T10:10:00+02:00',
    }
    const inbound = {
      ...validEvent,
      title: 'Flight FR9267 CPH -> BVA',
      startsAt: '2026-08-08T20:05:00+02:00',
      endsAt: '2026-08-08T22:00:00+02:00',
    }
    invoke.mockResolvedValue({ data: { events: [outbound, inbound] }, error: null })
    const result = await parseEmailViaAi('ryanair round trip')
    expect(result.events).toHaveLength(2)
    expect(result.events[0].startsAt).toBe('2026-07-27T08:20:00+02:00')
    expect(result.events[1].startsAt).toBe('2026-08-08T20:05:00+02:00')
  })

  it('drops an item that is not an object at all', async () => {
    invoke.mockResolvedValue({ data: { events: [validEvent, 'garbage', 42] }, error: null })
    const result = await parseEmailViaAi('scalar junk')
    expect(result.events).toHaveLength(1)
  })
})
