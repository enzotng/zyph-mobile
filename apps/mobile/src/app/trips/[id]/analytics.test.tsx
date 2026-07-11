import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createMMKV } from 'react-native-mmkv'

import AnalyticsScreen from './analytics'

const mockUseExpenses = jest.fn()
const mockUseTrip = jest.fn()
const mockUseAuth = jest.fn()
const mockUpdateTripPreferences = jest.fn().mockResolvedValue(undefined)

// In-memory MMKV (shared across createMMKV calls) so any MMKV-backed store used by the app
// shell has a working implementation under test, mirroring the copilot screen harness.
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>()
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value)
      },
      remove: (key: string) => {
        store.delete(key)
      },
      clearAll: () => {
        store.clear()
      },
    }),
  }
})

jest.mock('@/lib/supabase')

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 't1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('@/features/expenses', () => ({
  ...jest.requireActual('@/features/expenses'),
  useExpenses: (id: string) => mockUseExpenses(id),
}))
jest.mock('@/features/trips', () => ({
  ...jest.requireActual('@/features/trips'),
  useTrip: (id: string) => mockUseTrip(id),
  useUpdateTripPreferences: () => ({ mutateAsync: mockUpdateTripPreferences, isPending: false }),
}))
jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockStore = createMMKV({ id: 'test' }) as unknown as { clearAll: () => void }

const expense = (over: object) => ({
  id: 'e',
  trip_id: 't1',
  description: 'x',
  amount_cents: 1000,
  base_amount_cents: 1000,
  currency: 'EUR',
  fx_rate: 1,
  category: 'food',
  subcategory: null,
  paid_by: 'u1',
  created_by: 'u1',
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z',
  deleted_at: null,
  version: 1,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockStore.clearAll()
  mockUpdateTripPreferences.mockResolvedValue(undefined)
  // Default session matches the trip's owner_id, so tests that don't care about ownership
  // (spend totals, category bars...) keep the pre-gate owner behaviour.
  mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } } })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: null },
    isLoading: false,
    isError: false,
  })
})

it('shows the trip total spend', () => {
  mockUseExpenses.mockReturnValue({
    data: [
      expense({ base_amount_cents: 1200 }),
      expense({ base_amount_cents: 800, category: 'transport' }),
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  render(<AnalyticsScreen />)
  expect(screen.getByText('20.00 EUR')).toBeTruthy()
})

it('shows the empty state when there are no expenses', () => {
  mockUseExpenses.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  render(<AnalyticsScreen />)
  expect(screen.getByText('No spending yet')).toBeTruthy()
})

it('shows the error state when a query fails', () => {
  mockUseExpenses.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: jest.fn(),
  })
  render(<AnalyticsScreen />)
  expect(screen.getByText('Could not load stats')).toBeTruthy()
})

it('renders a category bar with its label and amount', () => {
  mockUseExpenses.mockReturnValue({
    data: [
      expense({ base_amount_cents: 1500, category: 'food' }),
      expense({ base_amount_cents: 500, category: 'transport' }),
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  render(<AnalyticsScreen />)
  // The category label now also renders once in the donut legend, so there are two matches
  // ("Food & drink" chip in the legend + the bar row itself).
  expect(screen.getAllByText('Food & drink').length).toBeGreaterThan(0)
  expect(screen.getByText('15.00 EUR')).toBeTruthy()
})

it('reveals subcategory spend when a category row is pressed', () => {
  mockUseExpenses.mockReturnValue({
    data: [
      expense({ base_amount_cents: 1000, category: 'food', subcategory: 'food.restaurant' }),
      expense({ base_amount_cents: 500, category: 'food', subcategory: 'food.bar' }),
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  render(<AnalyticsScreen />)

  expect(screen.queryByText('Restaurant')).toBeNull()

  fireEvent.press(screen.getByLabelText('Food & drink'))

  expect(screen.getByText('Restaurant')).toBeTruthy()
  expect(screen.getByText('10.00 EUR')).toBeTruthy()
  expect(screen.getByText('Bar')).toBeTruthy()
  expect(screen.getByText('5.00 EUR')).toBeTruthy()
})

it('shows the set-budget CTA when no budget is set', () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  // The CTA is owner-only: the mocked session user must match the trip's owner_id.
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: null },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)
  expect(screen.getByText('Set a budget')).toBeTruthy()
})

it('shows the budget gauge when a budget is set', () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: 5000 },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)
  expect(screen.getByText('40.00 EUR left')).toBeTruthy()
})

it('never shows the set-budget CTA to a non-owner, even with no budget set', () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  // Session user differs from the trip's owner_id: the trips_update_owner RLS would reject a
  // write from this user, so the UI must not offer the CTA either.
  mockUseAuth.mockReturnValue({ session: { user: { id: 'u2' } } })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: null },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)
  expect(screen.queryByText('Set a budget')).toBeNull()
})

it('echoes the trip profile fields when saving a new budget', async () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: {
      id: 't1',
      currency: 'EUR',
      owner_id: 'u1',
      budget_total_cents: null,
      trip_type: 'beach',
      budget_level: 'medium',
      pace: 'relaxed',
      interests: ['food'],
      dietary: ['vegetarian'],
    },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  fireEvent.press(screen.getByText('Set a budget'))
  fireEvent.changeText(screen.getByPlaceholderText('Total budget'), '500')
  await act(async () => {
    fireEvent.press(screen.getByText('Save'))
  })

  expect(mockUpdateTripPreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 't1',
      tripType: 'beach',
      budgetLevel: 'medium',
      budgetTotalCents: 50000,
      pace: 'relaxed',
      interests: ['food'],
      dietary: ['vegetarian'],
    }),
  )
})

it('rejects a malformed budget instead of clearing it', async () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: null },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  fireEvent.press(screen.getByText('Set a budget'))
  fireEvent.changeText(screen.getByPlaceholderText('Total budget'), '.')
  await act(async () => {
    fireEvent.press(screen.getByText('Save'))
  })

  // A degenerate amount (a lone '.') must never reach the mutation - toCents('.') is NaN,
  // which supabase-js would serialize to null and silently clear the trip budget.
  expect(mockUpdateTripPreferences).not.toHaveBeenCalled()
  expect(screen.getByText('Enter a valid amount')).toBeTruthy()
  expect(screen.getByPlaceholderText('Total budget')).toBeTruthy()
})

it('lets the owner open an existing budget pre-filled for editing', async () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: 5000 },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  fireEvent.press(screen.getByLabelText('Edit'))
  expect(screen.getByPlaceholderText('Total budget').props.value).toBe('50.00')

  await act(async () => {
    fireEvent.press(screen.getByText('Save'))
  })

  expect(mockUpdateTripPreferences).toHaveBeenCalledWith(
    expect.objectContaining({ id: 't1', budgetTotalCents: 5000 }),
  )
})

it('lets the owner edit an existing budget to a new value', async () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: {
      id: 't1',
      currency: 'EUR',
      owner_id: 'u1',
      budget_total_cents: 5000,
      trip_type: 'beach',
      budget_level: 'medium',
      pace: 'relaxed',
      interests: ['food'],
      dietary: ['vegetarian'],
    },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  fireEvent.press(screen.getByLabelText('Edit'))
  fireEvent.changeText(screen.getByPlaceholderText('Total budget'), '750')
  await act(async () => {
    fireEvent.press(screen.getByText('Save'))
  })

  expect(mockUpdateTripPreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 't1',
      tripType: 'beach',
      budgetLevel: 'medium',
      budgetTotalCents: 75000,
      pace: 'relaxed',
      interests: ['food'],
      dietary: ['vegetarian'],
    }),
  )
})

it('lets the owner cancel editing an existing budget without saving', async () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: 5000 },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  fireEvent.press(screen.getByLabelText('Edit'))
  fireEvent.changeText(screen.getByPlaceholderText('Total budget'), '750')
  fireEvent.press(screen.getByText('Cancel'))

  expect(mockUpdateTripPreferences).not.toHaveBeenCalled()
  expect(screen.queryByPlaceholderText('Total budget')).toBeNull()
  expect(screen.getByText('40.00 EUR left')).toBeTruthy()
})

it('never shows the budget edit affordance to a non-owner, even with a budget set', () => {
  mockUseExpenses.mockReturnValue({
    data: [expense({ base_amount_cents: 1000 })],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  // Session user differs from the trip's owner_id: the field must stay unreachable.
  mockUseAuth.mockReturnValue({ session: { user: { id: 'u2' } } })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', currency: 'EUR', owner_id: 'u1', budget_total_cents: 5000 },
    isLoading: false,
    isError: false,
  })
  render(<AnalyticsScreen />)

  expect(screen.getByText('40.00 EUR left')).toBeTruthy()
  expect(screen.queryByLabelText('Edit')).toBeNull()
  expect(screen.queryByPlaceholderText('Total budget')).toBeNull()
})
