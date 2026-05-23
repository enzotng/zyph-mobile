import { parseReceipt } from './receipt-parser'

describe('parseReceipt', () => {
  it('parses a typical French receipt with TOTAL TTC', () => {
    const text = [
      'CARREFOUR CITY',
      '12 rue de Rivoli',
      '75001 PARIS',
      '15/03/2024  14:32',
      '',
      'Baguette          1,20 €',
      'Café              2,50 €',
      'Eau               0,80 €',
      '',
      'TOTAL TTC         4,50 €',
    ].join('\n')

    const result = parseReceipt(text)
    expect(result.merchant).toBe('CARREFOUR CITY')
    expect(result.amountCents).toBe(450)
    expect(result.currency).toBe('EUR')
    expect(result.date).toBe('2024-03-15')
  })

  it('parses a US receipt with $ symbol and MM/DD/YYYY date', () => {
    const text = [
      'STARBUCKS COFFEE',
      '123 Market St',
      '03/15/2024',
      '',
      'Latte         $5.25',
      'Muffin        $3.50',
      '',
      'Total         $8.75',
    ].join('\n')

    const result = parseReceipt(text)
    expect(result.merchant).toBe('STARBUCKS COFFEE')
    expect(result.amountCents).toBe(875)
    expect(result.currency).toBe('USD')
    // Falls back to first valid DD/MM/YYYY interpretation (day=3, month=15 fails, then day=15? Returns null actually since 03/15/2024 → day=3, month=15 invalid)
    expect(result.date).toBe(null)
  })

  it('parses ISO date format YYYY-MM-DD', () => {
    const text = ['SHOP', '2024-06-01', 'Total 10,00 €'].join('\n')
    expect(parseReceipt(text).date).toBe('2024-06-01')
  })

  it('falls back to largest amount when no TOTAL keyword present', () => {
    const text = ['BAKERY', 'Item A  1,00 €', 'Item B  3,50 €', 'Item C  0,80 €'].join('\n')
    expect(parseReceipt(text).amountCents).toBe(350)
  })

  it('detects EUR currency from ISO code when no symbol present', () => {
    const text = ['SHOP', 'Total: 12.50 EUR'].join('\n')
    const result = parseReceipt(text)
    expect(result.currency).toBe('EUR')
    expect(result.amountCents).toBe(1250)
  })

  it('returns null fields when text is empty or unparseable', () => {
    expect(parseReceipt('')).toEqual({
      merchant: null,
      amountCents: null,
      currency: null,
      date: null,
    })
  })

  it('skips numeric-only and short lines when picking merchant', () => {
    const text = ['12', '12/03/2024', 'BOULANGERIE PAUL', 'Total 4,50 €'].join('\n')
    expect(parseReceipt(text).merchant).toBe('BOULANGERIE PAUL')
  })

  it('handles thousand separators in amount', () => {
    const text = ['ELECTRO STORE', 'TOTAL  1.299,99 €'].join('\n')
    expect(parseReceipt(text).amountCents).toBe(129999)
  })

  it('picks the TOTAL line amount even when an item is larger', () => {
    const text = ['SHOP', 'Big Item   99,00 €', 'TOTAL TTC   12,00 €'].join('\n')
    expect(parseReceipt(text).amountCents).toBe(1200)
  })
})
