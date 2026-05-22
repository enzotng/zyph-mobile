import { joinTripSchema } from './schemas'

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
