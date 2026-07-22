import { createEventSchema } from './schemas'

const base = {
  title: 'Museum visit',
  startsAt: '2026-05-22T10:00:00.000Z',
  endsAt: '',
  notes: '',
}

describe('createEventSchema', () => {
  it('accepts a point event with no end time', () => {
    expect(createEventSchema.safeParse(base).success).toBe(true)
  })

  it('requires a valid category and accepts a null subcategory', () => {
    expect(
      createEventSchema.safeParse({ ...base, category: 'food', subcategory: null }).success,
    ).toBe(true)
    expect(
      createEventSchema.safeParse({ ...base, category: 'food', subcategory: 'food.restaurant' })
        .success,
    ).toBe(true)
    expect(
      createEventSchema.safeParse({ ...base, category: 'nope', subcategory: null }).success,
    ).toBe(false)
    expect(
      createEventSchema.safeParse({ ...base, category: 'food', subcategory: 'transport.flight' })
        .success,
    ).toBe(false)
  })

  it('accepts an end time after the start', () => {
    const result = createEventSchema.safeParse({
      ...base,
      endsAt: '2026-05-22T12:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('rejects an end time before the start', () => {
    const result = createEventSchema.safeParse({
      ...base,
      endsAt: '2026-05-22T09:00:00.000Z',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['endsAt'])
  })

  it('requires a title', () => {
    expect(createEventSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
  })

  it('requires a start date', () => {
    expect(createEventSchema.safeParse({ ...base, startsAt: '' }).success).toBe(false)
  })
})
