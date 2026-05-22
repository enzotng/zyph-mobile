import { createTripSchema } from './schemas'

describe('createTripSchema', () => {
  it('requires a title', () => {
    const result = createTripSchema.safeParse({ title: '', destination: '', currency: 'EUR' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid trip', () => {
    const result = createTripSchema.safeParse({ title: 'Rome', destination: '', currency: 'EUR' })
    expect(result.success).toBe(true)
  })

  it('rejects a currency that is not 3 letters', () => {
    const result = createTripSchema.safeParse({ title: 'Rome', destination: '', currency: 'EU' })
    expect(result.success).toBe(false)
  })
})
