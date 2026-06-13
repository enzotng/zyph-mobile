import { formatAmount, formatRate, signedAmount } from './money'

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

describe('formatRate', () => {
  it('formats a sub-unit rate trimming trailing zeros', () => {
    expect(formatRate(0.92, 'USD', 'EUR')).toBe('1 USD = 0.92 EUR')
  })

  it('keeps significant decimals up to four places', () => {
    expect(formatRate(1.0832, 'EUR', 'USD')).toBe('1 EUR = 1.0832 USD')
  })

  it('drops the decimal part for whole rates', () => {
    expect(formatRate(150, 'EUR', 'JPY')).toBe('1 EUR = 150 JPY')
  })
})
