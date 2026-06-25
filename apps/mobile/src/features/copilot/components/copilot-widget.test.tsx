import { render, screen } from '@testing-library/react-native'

import { useExpenses } from '@/features/expenses'
import { useTrip } from '@/features/trips'

import { CopilotWidget } from './copilot-widget'

// Stub the supabase client so the real module never tries to connect.
jest.mock('@/lib/supabase')

// Stub the expenses hook so SpendByCategoryWidget renders from fixture data.
jest.mock('@/features/expenses', () => {
  const actual = jest.requireActual('@/features/expenses')
  return { ...actual, useExpenses: jest.fn() }
})

// Stub the trip hook so the widget gets a currency without a real query.
jest.mock('@/features/trips', () => {
  const actual = jest.requireActual('@/features/trips')
  return { ...actual, useTrip: jest.fn() }
})

const useExpensesMock = useExpenses as jest.Mock
const useTripMock = useTrip as jest.Mock

function makeExpense(id: string, category: string | null, base_amount_cents: number) {
  return {
    id,
    trip_id: 't1',
    description: `Expense ${id}`,
    amount_cents: base_amount_cents,
    base_amount_cents,
    category,
    currency: 'EUR',
    fx_rate: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    paid_by: null,
    deleted_at: null,
    version: 1,
  }
}

const FIXTURE_EXPENSES = [
  makeExpense('e1', 'food', 8000),
  makeExpense('e2', 'food', 2000),
  makeExpense('e3', 'transport', 5000),
  makeExpense('e4', 'accommodation', 3000),
]

const TRIP_FIXTURE = {
  id: 't1',
  title: 'Test trip',
  currency: 'EUR',
  destination: 'Paris',
  start_date: '2026-06-01',
  end_date: '2026-06-07',
  cover_photo_url: null,
  cover_photo_author: null,
  cover_photo_author_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  invite_code: 'ABC',
  owner_id: 'u1',
  latitude: null,
  longitude: null,
}

describe('CopilotWidget spend_by_category', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useExpensesMock.mockReturnValue({ data: FIXTURE_EXPENSES })
    useTripMock.mockReturnValue({ data: TRIP_FIXTURE })
  })

  it('renders the widget title', () => {
    render(<CopilotWidget type="spend_by_category" tripId="t1" />)
    expect(screen.getByText('Spending by category')).toBeTruthy()
  })

  it('renders each category label', () => {
    render(<CopilotWidget type="spend_by_category" tripId="t1" />)

    // i18n translates known keys (food -> "Food", transport -> "Transport");
    // unknown keys fall back to the key string.
    expect(screen.getByText('Food')).toBeTruthy()
    expect(screen.getByText('Transport')).toBeTruthy()
    // "accommodation" key may or may not be translated depending on the test i18n fixture -
    // assert the text node exists by querying either form.
    const accommodationLabel =
      screen.queryByText('Accommodation') ?? screen.queryByText('categories.accommodation')
    expect(accommodationLabel).toBeTruthy()
  })

  it('renders the top (largest) category with its formatted amount', () => {
    render(<CopilotWidget type="spend_by_category" tripId="t1" />)

    // Food is the top category (8000 + 2000 = 10000 cents). Assert both its label and amount.
    expect(screen.getByText('Food')).toBeTruthy()
    // Amount renders as "100.00 EUR" under the test locale.
    expect(screen.getByText('100.00 EUR')).toBeTruthy()
  })

  it('renders nothing when expenses are absent', () => {
    useExpensesMock.mockReturnValue({ data: [] })
    const { toJSON } = render(<CopilotWidget type="spend_by_category" tripId="t1" />)
    expect(toJSON()).toBeNull()
  })

  it('renders nothing when trip data is absent', () => {
    useTripMock.mockReturnValue({ data: undefined })
    const { toJSON } = render(<CopilotWidget type="spend_by_category" tripId="t1" />)
    expect(toJSON()).toBeNull()
  })
})
