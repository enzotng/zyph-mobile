import { createExpenseSchema, formatAmount, toCents } from './schemas'

describe('expense helpers', () => {
  it('rejects an invalid amount', () => {
    expect(createExpenseSchema.safeParse({ description: 'Dinner', amount: 'abc' }).success).toBe(
      false,
    )
  })

  it('accepts a decimal amount', () => {
    expect(createExpenseSchema.safeParse({ description: 'Dinner', amount: '45.00' }).success).toBe(
      true,
    )
  })

  it('toCents converts decimals (dot or comma) to integer cents', () => {
    expect(toCents('45.00')).toBe(4500)
    expect(toCents('45,5')).toBe(4550)
    expect(toCents('10')).toBe(1000)
  })

  it('formatAmount renders cents with the currency', () => {
    expect(formatAmount(4500, 'EUR')).toBe('45.00 EUR')
  })
})
