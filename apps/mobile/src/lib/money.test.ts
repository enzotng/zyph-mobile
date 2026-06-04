import { formatAmount, signedAmount } from './money'

describe('formatAmount', () => {
  it('formats cents with two decimals and the currency', () => {
    expect(formatAmount(1250, 'EUR')).toBe('12.50 EUR')
  })

  it('keeps the negative sign', () => {
    expect(formatAmount(-850, 'EUR')).toBe('-8.50 EUR')
  })
})

describe('signedAmount', () => {
  it('prefixes a plus sign for positive amounts', () => {
    expect(signedAmount(1200, 'EUR')).toBe('+12.00 EUR')
  })

  it('leaves negative amounts as-is', () => {
    expect(signedAmount(-800, 'EUR')).toBe('-8.00 EUR')
  })

  it('does not sign zero', () => {
    expect(signedAmount(0, 'USD')).toBe('0.00 USD')
  })
})
