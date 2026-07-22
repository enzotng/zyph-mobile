import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { type ChatMessage, saveCopilotHistory } from '@/features/copilot'
import type { Poi } from '@/features/places'
import { openEncryptedMMKV } from '@/lib/storage-encryption'

import CopilotScreen from './copilot'

// The screen fetches POI candidates before it asks the copilot; this spy lets each test hold that
// promise pending to reproduce the double-send window.
const mockSearchPois = jest.fn<Promise<Poi[]>, [unknown]>()
// The copilot mutation is stubbed so no network runs and the turn count is directly assertable.
const mockAskMutate = jest.fn()

// In-memory store (shared across openEncryptedMMKV calls) so loadCopilotHistory can be seeded
// per test.
jest.mock('@/lib/storage-encryption', () => {
  const store = new Map<string, string>()
  return {
    openEncryptedMMKV: () => ({
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
  useGlobalSearchParams: () => ({ id: 't1' }),
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), push: jest.fn() }),
}))

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// POI search is held pending per test; googleTypesFor + usePoiPhoto are trivial stubs.
jest.mock('@/features/places', () => ({
  searchPois: (input: unknown) => mockSearchPois(input),
  googleTypesFor: () => [],
  usePoiPhoto: () => ({ data: null }),
}))

// Data hooks return ready data so `dataReady` is true and the trip carries coordinates (required
// for a planning search). The exact shapes are irrelevant: buildTripContext is stubbed below.
jest.mock('@/features/trips', () => ({
  useTrip: () => ({
    data: { id: 't1', latitude: 48.85, longitude: 2.35, interests: [] },
    isError: false,
    refetch: jest.fn(),
  }),
}))
jest.mock('@/features/timeline', () => ({
  useEvents: () => ({ data: [], isError: false, refetch: jest.fn() }),
  useCreateEvents: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))
jest.mock('@/features/expenses', () => ({
  useExpenses: () => ({ data: [], isError: false, refetch: jest.fn() }),
  useTripBalances: () => ({ data: [], isError: false, refetch: jest.fn() }),
}))
jest.mock('@/features/group', () => ({
  useTripMembers: () => ({ data: [], isError: false, refetch: jest.fn() }),
}))
jest.mock('@/features/packing', () => ({
  usePackingItems: () => ({ data: [] }),
  groupReadiness: () => ({ ready: 0, total: 0 }),
}))
jest.mock('@/features/settlements', () => ({
  useSettlements: () => ({ data: [] }),
}))
jest.mock('@/features/weather', () => ({
  useTripWeather: () => ({ data: null }),
  WeatherCard: () => null,
}))
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))

// Keep the real history/context barrel (so the seeded conversation loads through the mocked MMKV)
// but stub the two mutation hooks and buildTripContext so no network runs and the ask count is a
// clean signal.
jest.mock('@/features/copilot', () => {
  const actual = jest.requireActual('@/features/copilot')
  return {
    ...actual,
    useAskCopilot: () => ({ mutate: mockAskMutate, isPending: false }),
    useExecuteCopilotAction: () => ({ mutate: jest.fn(), isPending: false }),
    buildTripContext: () => 'ctx',
  }
})

const mockStore = openEncryptedMMKV('test') as unknown as { clearAll: () => void }

// An assistant turn carrying a prompt chip: tapping it calls send() WITHOUT going through the
// composer (which disables itself while busy), reproducing the real double-send vectors (a prompt
// chip in history, or the itinerary Regenerate button) that only the runAsk turn guard can close.
const SEEDED: ChatMessage[] = [
  { id: 'm1', role: 'user', blocks: [{ kind: 'text', text: 'hi' }] },
  {
    id: 'm2',
    role: 'assistant',
    blocks: [
      { kind: 'text', text: 'Ideas' },
      { kind: 'chips', chips: [{ action: 'prompt', prompt: 'plan my day', label: 'Plan my day' }] },
    ],
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockStore.clearAll()
  // Default: the POI search never resolves on its own, so the pending window stays open.
  mockSearchPois.mockImplementation(() => new Promise<Poi[]>(() => {}))
})

describe('CopilotScreen double-send guard', () => {
  it('drops a second send fired while the POI search is still pending', () => {
    saveCopilotHistory('t1', SEEDED)

    render(<CopilotScreen />)

    // First tap opens the turn: the POI search fires and the thinking spinner shows immediately,
    // even though the copilot mutation has not run yet (it awaits the search).
    fireEvent.press(screen.getByText('Plan my day'))
    expect(mockSearchPois).toHaveBeenCalledTimes(1)
    expect(mockAskMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Zo is thinking…')).toBeTruthy()

    // Second tap during the pending window must be dropped by the synchronous turn guard.
    fireEvent.press(screen.getByText('Plan my day'))
    expect(mockSearchPois).toHaveBeenCalledTimes(1)
    expect(mockAskMutate).not.toHaveBeenCalled()
  })

  it('reaches the copilot exactly once after the search resolves, then re-arms', async () => {
    // The mutation settles synchronously so the turn guard is released within this test.
    mockAskMutate.mockImplementation((_vars, opts) => {
      opts?.onSettled?.()
    })
    let resolveSearch: ((pois: Poi[]) => void) | undefined
    mockSearchPois.mockImplementation(
      () =>
        new Promise<Poi[]>((res) => {
          resolveSearch = res
        }),
    )
    saveCopilotHistory('t1', SEEDED)

    render(<CopilotScreen />)

    fireEvent.press(screen.getByText('Plan my day'))
    // Resolve the pending search (and flush the awaiting IIFE) so the single in-flight turn
    // reaches the mutation exactly once.
    await act(async () => {
      resolveSearch?.([])
    })
    expect(mockAskMutate).toHaveBeenCalledTimes(1)

    // The guard is released on onSettled, so a fresh send starts a second turn.
    fireEvent.press(screen.getByText('Plan my day'))
    expect(mockSearchPois).toHaveBeenCalledTimes(2)
  })
})
