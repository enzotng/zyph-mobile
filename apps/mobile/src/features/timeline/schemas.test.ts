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
