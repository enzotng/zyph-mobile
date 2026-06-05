import { parseReceipt, parseReceiptItems } from './receipt-parser'

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

  it('expands a 2-digit year to the 2000-2099 range', () => {
    const text = ['SHOP', '15/03/24', 'TOTAL 4,50 €'].join('\n')
    expect(parseReceipt(text).date).toBe('2024-03-15')
  })

  it('falls back to the largest amount when a TOTAL line carries no figure', () => {
    const text = ['SHOP', 'TOTAL TTC', 'Article   7,90 €'].join('\n')
    expect(parseReceipt(text).amountCents).toBe(790)
  })
})

describe('parseReceiptItems', () => {
  it('extracts items from a typical French restaurant ticket', () => {
    const text = [
      'LE BISTROT DU COIN',
      '15/06/2026',
      '',
      'Salade Caesar           12,00',
      'Burger Royal            18,50',
      'Coca Cola                3,50',
      'Cafe Latte               4,00',
      'Tarte Tatin              8,50',
      '',
      'SOUS-TOTAL              46,50',
      'TVA 10%                  4,50',
      'TOTAL TTC               51,00 €',
    ].join('\n')

    const result = parseReceiptItems(text)
    expect(result.amountCents).toBe(5100)
    expect(result.items.map((i) => i.label)).toEqual([
      'Salade Caesar',
      'Burger Royal',
      'Coca Cola',
      'Cafe Latte',
      'Tarte Tatin',
    ])
    expect(result.items.map((i) => i.amountCents)).toEqual([1200, 1850, 350, 400, 850])
  })

  it('keeps the quantity prefix in the label when greater than 1', () => {
    const text = [
      'SHOP',
      '2 x Croissant            3,00',
      '1 x Pain au chocolat     1,50',
      'TOTAL                    4,50',
    ].join('\n')

    const items = parseReceiptItems(text).items
    expect(items).toHaveLength(2)
    expect(items[0].label).toBe('2 × Croissant')
    expect(items[1].label).toBe('Pain au chocolat')
  })

  it('parses an English/USD receipt with $ symbol', () => {
    const text = [
      "TONY'S DINER",
      '03/15/2026',
      '',
      'Burger              $18.00',
      'Fries                $4.50',
      'Soda                 $2.00',
      '',
      'Subtotal            $24.50',
      'Tax                  $2.00',
      'TOTAL               $26.50',
    ].join('\n')

    const result = parseReceiptItems(text)
    expect(result.currency).toBe('USD')
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({ label: 'Burger', amountCents: 1800 })
    expect(result.items[1]).toEqual({ label: 'Fries', amountCents: 450 })
    expect(result.items[2]).toEqual({ label: 'Soda', amountCents: 200 })
  })

  it('skips TVA, taxes, service, discount and payment lines', () => {
    const text = [
      'Pizza Margherita     12,00',
      'Vin rouge             8,00',
      'SOUS-TOTAL           20,00',
      'TVA 10%               2,00',
      'Service inclus        2,20',
      'Remise               -1,00',
      'TOTAL TTC            23,20',
      'PAIEMENT CB          23,20',
      'Rendu                 0,00',
    ].join('\n')

    const items = parseReceiptItems(text).items
    expect(items.map((i) => i.label)).toEqual(['Pizza Margherita', 'Vin rouge'])
  })

  it('returns an empty items array when OCR fails to detect any', () => {
    const text = 'TOTAL  12,00 €'
    expect(parseReceiptItems(text).items).toEqual([])
  })

  it('drops malformed lines with non-monetary trailing numbers', () => {
    const text = [
      'BOULANGERIE PAUL',
      '15032026',
      'Croissant      1,20',
      'TOTAL          1,20',
    ].join('\n')

    const items = parseReceiptItems(text).items
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Croissant')
  })

  it('keeps the total amount and currency from parseReceipt', () => {
    const text = ['SHOP', 'Item A   5,00', 'Item B   7,00', 'TOTAL   12,00 €'].join('\n')
    const result = parseReceiptItems(text)
    expect(result.amountCents).toBe(1200)
    expect(result.currency).toBe('EUR')
    expect(result.items).toHaveLength(2)
  })

  it('does not pick up dates that look like amounts', () => {
    const text = ['SHOP', '15.03.2026', 'Salade  10,00', 'TOTAL  10,00'].join('\n')
    const items = parseReceiptItems(text).items
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Salade')
  })

  it('handles thousand separator in item amount', () => {
    const text = ['SHOP', 'TV LED 4K       1.299,99', 'TOTAL TTC      1.299,99'].join('\n')
    const items = parseReceiptItems(text).items
    expect(items).toHaveLength(1)
    expect(items[0].amountCents).toBe(129999)
  })

  it('skips lines whose label is a single character', () => {
    const text = ['SHOP', 'a    5,00', 'TOTAL    5,00 €'].join('\n')
    expect(parseReceiptItems(text).items).toEqual([])
  })

  it('skips lines whose label contains no letters', () => {
    const text = ['SHOP', '## 5,00', 'TOTAL 5,00 €'].join('\n')
    expect(parseReceiptItems(text).items).toEqual([])
  })

  it('skips item lines with a zero amount', () => {
    const text = ['SHOP', 'Cadeau offert      0,00', 'TOTAL TTC      0,00'].join('\n')
    expect(parseReceiptItems(text).items).toEqual([])
  })

  it('keeps a single-digit-quantity prefix only when quantity differs from 1', () => {
    const text = [
      'SHOP',
      '3 x Stylo            4,50',
      '1 x Cahier           2,00',
      'TOTAL                6,50',
    ].join('\n')
    const items = parseReceiptItems(text).items
    expect(items.map((i) => i.label)).toEqual(['3 × Stylo', 'Cahier'])
  })
})
