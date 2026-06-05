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
  it('invokes the parser function with the text body and returns the validated event', async () => {
    invoke.mockResolvedValue({ data: { event: validEvent }, error: null })

    await expect(parseEmailViaAi('booking confirmation')).resolves.toEqual({ event: validEvent })
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
      data: { event: { ...validEvent, type: 'spaceship' } },
      error: null,
    })

    const result = await parseEmailViaAi('weird type')

    expect(result.event.type).toBe('event')
  })

  it('coerces a non-integer price to null at the zod boundary', async () => {
    invoke.mockResolvedValue({
      data: { event: { ...validEvent, priceCents: 12.5 } },
      error: null,
    })

    const result = await parseEmailViaAi('fractional price')

    expect(result.event.priceCents).toBeNull()
  })

  it('clamps a 0-100 scale confidence down to the 0-1 range', async () => {
    invoke.mockResolvedValue({
      data: { event: { ...validEvent, confidence: 75 } },
      error: null,
    })

    const result = await parseEmailViaAi('percent confidence')

    expect(result.event.confidence).toBeCloseTo(0.75)
  })

  it('keeps an already-normalized confidence within the 0-1 range untouched', async () => {
    invoke.mockResolvedValue({
      data: { event: { ...validEvent, confidence: 0.42 } },
      error: null,
    })

    const result = await parseEmailViaAi('fraction confidence')

    expect(result.event.confidence).toBeCloseTo(0.42)
  })

  it('clamps a negative confidence to 0 and defaults a non-numeric confidence to 0', async () => {
    invoke.mockResolvedValueOnce({
      data: { event: { ...validEvent, confidence: -3 } },
      error: null,
    })
    const negative = await parseEmailViaAi('negative confidence')
    expect(negative.event.confidence).toBe(0)

    invoke.mockResolvedValueOnce({
      data: { event: { ...validEvent, confidence: 'high' } },
      error: null,
    })
    const nonNumeric = await parseEmailViaAi('text confidence')
    expect(nonNumeric.event.confidence).toBe(0)
  })

  it('accepts null location and gateLocation', async () => {
    invoke.mockResolvedValue({
      data: { event: { ...validEvent, location: null, gateLocation: null } },
      error: null,
    })

    const result = await parseEmailViaAi('no location')

    expect(result.event.location).toBeNull()
    expect(result.event.gateLocation).toBeNull()
  })

  it('throws at the zod boundary when a required field has the wrong type', async () => {
    invoke.mockResolvedValue({
      data: { event: { ...validEvent, title: 123 } },
      error: null,
    })

    await expect(parseEmailViaAi('bad title')).rejects.toThrow()
  })

  it('throws at the zod boundary when the event is missing entirely', async () => {
    invoke.mockResolvedValue({ data: { event: undefined }, error: null })

    await expect(parseEmailViaAi('missing event')).rejects.toThrow()
  })
})
