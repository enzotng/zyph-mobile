import type { TFunction } from 'i18next'
import { makeUpdateProfileSchema } from './schemas'

// i18n factory schema; the mock t just echoes the key (messages are not asserted here).
const t = ((key: string) => key) as unknown as TFunction
const updateProfileSchema = makeUpdateProfileSchema(t)

describe('updateProfileSchema', () => {
  it('accepts a valid name and 3-letter currency', () => {
    const result = updateProfileSchema.safeParse({ displayName: 'Alice', preferredCurrency: 'EUR' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = updateProfileSchema.safeParse({ displayName: '', preferredCurrency: 'EUR' })
    expect(result.success).toBe(false)
  })

  it('rejects a name with only whitespace', () => {
    const result = updateProfileSchema.safeParse({ displayName: '   ', preferredCurrency: 'EUR' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-3-letter currency code', () => {
    const result = updateProfileSchema.safeParse({ displayName: 'Alice', preferredCurrency: 'EU' })
    expect(result.success).toBe(false)
  })
})
