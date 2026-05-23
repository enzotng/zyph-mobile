import { filterExpenses } from './filter'

const make = (overrides: { id: string; description: string; category?: string | null }) => ({
  id: overrides.id,
  trip_id: 't1',
  description: overrides.description,
  amount_cents: 1000,
  base_amount_cents: 1000,
  currency: 'EUR',
  fx_rate: 1,
  created_by: 'u1',
  paid_by: 'm1',
  deleted_at: null,
  category: overrides.category ?? null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
})

const expenses = [
  make({ id: 'e1', description: 'Dinner at Luigi', category: 'food' }),
  make({ id: 'e2', description: 'Taxi to airport', category: 'transport' }),
  make({ id: 'e3', description: 'Hotel night', category: 'lodging' }),
  make({ id: 'e4', description: 'Random expense', category: null }),
]

describe('filterExpenses', () => {
  it('returns everything when no filter is provided', () => {
    expect(filterExpenses(expenses, {})).toHaveLength(4)
  })

  it('matches description case-insensitively', () => {
    const result = filterExpenses(expenses, { query: 'TAXI' })
    expect(result.map((e) => e.id)).toEqual(['e2'])
  })

  it('matches a substring of the description', () => {
    const result = filterExpenses(expenses, { query: 'luigi' })
    expect(result.map((e) => e.id)).toEqual(['e1'])
  })

  it('filters by category', () => {
    const result = filterExpenses(expenses, { category: 'lodging' })
    expect(result.map((e) => e.id)).toEqual(['e3'])
  })

  it('combines query and category (AND)', () => {
    const result = filterExpenses(expenses, { query: 'dinner', category: 'transport' })
    expect(result).toHaveLength(0)
  })

  it('ignores empty/whitespace query', () => {
    expect(filterExpenses(expenses, { query: '   ' })).toHaveLength(4)
  })

  it('treats null category as no category filter', () => {
    expect(filterExpenses(expenses, { category: null })).toHaveLength(4)
  })

  it('excludes uncategorised expenses when filtering by a specific category', () => {
    const result = filterExpenses(expenses, { category: 'food' })
    expect(result.map((e) => e.id)).toEqual(['e1'])
  })
})
