import type { Expense } from './api/expenses.api'
import { type ExpenseCsvContext, expensesToCsv, neutralizeFormula, toCsv } from './csv-export'

describe('toCsv', () => {
  it('joins headers and rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2')
  })

  it('quotes fields containing a comma, quote or newline', () => {
    expect(toCsv(['x'], [['a,b']])).toBe('x\r\n"a,b"')
    expect(toCsv(['x'], [['a"b']])).toBe('x\r\n"a""b"')
    expect(toCsv(['x'], [['a\nb']])).toBe('x\r\n"a\nb"')
  })

  it('leaves plain fields unquoted', () => {
    expect(toCsv(['x'], [['plain']])).toBe('x\r\nplain')
  })
})

describe('neutralizeFormula', () => {
  it.each(['=cmd', '+1', '-1', '@x', '\tx'])('prefixes a formula trigger %p', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`)
  })

  it('leaves safe text untouched', () => {
    expect(neutralizeFormula('Dinner')).toBe('Dinner')
    expect(neutralizeFormula('12.50')).toBe('12.50')
  })
})

describe('expensesToCsv', () => {
  const labels = {
    date: 'Date',
    description: 'Description',
    category: 'Category',
    amount: 'Amount',
    currency: 'Currency',
    tripAmount: 'Amount (EUR)',
    paidBy: 'Paid by',
  }

  const ctx: ExpenseCsvContext = {
    labels,
    categoryLabel: (c) => (c ? c.toUpperCase() : ''),
    payerName: (id) => (id === 'm1' ? 'Alice' : 'Member'),
  }

  function expense(overrides: Partial<Expense>): Expense {
    return {
      created_at: '2026-06-10T12:34:56Z',
      description: 'Dinner',
      category: 'food',
      amount_cents: 1250,
      currency: 'USD',
      base_amount_cents: 1100,
      paid_by: 'm1',
      ...overrides,
    } as Expense
  }

  it('builds a header row and one row per expense', () => {
    const csv = expensesToCsv([expense({})], ctx)
    expect(csv).toBe(
      'Date,Description,Category,Amount,Currency,Amount (EUR),Paid by\r\n' +
        '2026-06-10,Dinner,FOOD,12.50,USD,11.00,Alice',
    )
  })

  it('formats cents as plain decimals and trims the date to YYYY-MM-DD', () => {
    const csv = expensesToCsv([expense({ amount_cents: 5, base_amount_cents: 0 })], ctx)
    const [, row] = csv.split('\r\n')
    expect(row).toContain('0.05')
    expect(row).toContain('0.00')
    expect(row.startsWith('2026-06-10,')).toBe(true)
  })

  it('escapes a description containing a comma and resolves an unknown payer', () => {
    const csv = expensesToCsv([expense({ description: 'Taxi, airport', paid_by: 'gone' })], ctx)
    const [, row] = csv.split('\r\n')
    expect(row).toContain('"Taxi, airport"')
    expect(row.endsWith(',Member')).toBe(true)
  })

  it('neutralizes a description that starts with a formula trigger', () => {
    const csv = expensesToCsv([expense({ description: '=SUM(A1:A9)' })], ctx)
    const [, row] = csv.split('\r\n')
    expect(row).toContain(`'=SUM(A1:A9)`)
  })

  it('renders an empty category label when none is set', () => {
    const csv = expensesToCsv([expense({ category: null })], ctx)
    const [, row] = csv.split('\r\n')
    // ...,Description,<empty category>,Amount,...
    expect(row).toContain('Dinner,,12.50')
  })
})
