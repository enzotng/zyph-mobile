import { claimOptionsSchema, joinTripSchema } from './schemas'

describe('joinTripSchema', () => {
  it('accepts a non-empty code and trims it', () => {
    const result = joinTripSchema.safeParse({ code: '  ABC123  ' })

    expect(result.success).toBe(true)
    expect(result.data?.code).toBe('ABC123')
  })

  it('rejects an empty code', () => {
    const result = joinTripSchema.safeParse({ code: '' })

    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only code', () => {
    const result = joinTripSchema.safeParse({ code: '   ' })

    expect(result.success).toBe(false)
  })
})

const TRIP_ID = '11111111-1111-4111-8111-111111111111'
const SLOT_ONE = '22222222-2222-4222-8222-222222222222'
const SLOT_TWO = '33333333-3333-4333-8333-333333333333'

describe('claimOptionsSchema', () => {
  it('parses a payload with free slots, keeping their order', () => {
    const result = claimOptionsSchema.parse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: null,
      slots: [
        { slotId: SLOT_ONE, slotName: 'Lea' },
        { slotId: SLOT_TWO, slotName: 'Marco' },
      ],
    })

    expect(result.tripId).toBe(TRIP_ID)
    expect(result.tripTitle).toBe('Lisbon')
    expect(result.myStatus).toBeNull()
    expect(result.slots.map((slot) => slot.slotName)).toEqual(['Lea', 'Marco'])
  })

  it('parses an empty slot list', () => {
    const result = claimOptionsSchema.parse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: 'active',
      slots: [],
    })

    expect(result.slots).toEqual([])
    expect(result.myStatus).toBe('active')
  })

  it.each(['invited', 'active', 'removed'] as const)('accepts myStatus %s', (status) => {
    const result = claimOptionsSchema.safeParse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: status,
      slots: [],
    })

    expect(result.success).toBe(true)
  })

  it('accepts a slot with no name', () => {
    const result = claimOptionsSchema.parse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: null,
      slots: [{ slotId: SLOT_ONE, slotName: null }],
    })

    expect(result.slots[0].slotName).toBeNull()
  })

  it('rejects an unknown myStatus', () => {
    const result = claimOptionsSchema.safeParse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: 'pending',
      slots: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects a missing slots array', () => {
    const result = claimOptionsSchema.safeParse({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: null,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a null payload', () => {
    expect(claimOptionsSchema.safeParse(null).success).toBe(false)
  })
})
