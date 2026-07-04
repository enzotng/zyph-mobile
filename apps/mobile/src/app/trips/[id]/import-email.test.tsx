import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import type { ParsedEmailEvent } from '@/features/smart-import'

import ImportEmailScreen from './import-email'

// The two feature hooks the screen consumes are stubbed so no network runs and the batch create
// call is directly assertable.
const mockParse = jest.fn<Promise<{ events: unknown[] }>, [string]>()
const mockCreateEvents = jest.fn().mockResolvedValue([])

jest.mock('@/lib/supabase')

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => ({ id: 't1' }),
  useRouter: () => ({ back: mockBack }),
}))

// The clipboard-hint banner is irrelevant here (no prefilled text, empty clipboard) - stub it out
// so the editor starts clean.
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn().mockResolvedValue('') }))

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// Host stub for the native date picker inside DateField: keeps the test output pristine (the real
// component logs an onChange deprecation warning) and no test here interacts with the picker.
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker')

jest.mock('@/features/smart-import', () => {
  const actual = jest.requireActual('@/features/smart-import')
  return { ...actual, useParseEmail: () => ({ mutateAsync: mockParse, isPending: false }) }
})
jest.mock('@/features/timeline', () => ({
  eventTypeIcon: () => 'calendar',
  useCreateEvents: () => ({ mutateAsync: mockCreateEvents, isPending: false }),
}))

// The exact Ryanair BVA<->CPH shape from the smart-import API regression (Task 2): two flights,
// same base fields, distinct titles + real dates.
const validEvent: ParsedEmailEvent = {
  type: 'flight',
  title: 'AF1234 Paris -> Rome',
  startsAt: '2026-06-10T08:00:00Z',
  endsAt: '2026-06-10T10:00:00Z',
  location: { name: 'Charles de Gaulle', lat: 49.0097, lng: 2.5479 },
  gateLocation: { label: 'Gate K12', lat: 49.0097, lng: 2.5479 },
  notes: 'Window seat',
  currency: 'EUR',
  priceCents: 12_000,
  confidence: 0.9,
}
const outbound: ParsedEmailEvent = {
  ...validEvent,
  title: 'Flight FR9266 BVA -> CPH',
  startsAt: '2026-07-27T08:20:00+02:00',
  endsAt: '2026-07-27T10:10:00+02:00',
}
const inbound: ParsedEmailEvent = {
  ...validEvent,
  title: 'Flight FR9267 CPH -> BVA',
  startsAt: '2026-08-08T20:05:00+02:00',
  endsAt: '2026-08-08T22:00:00+02:00',
}
const RYANAIR_EVENTS: ParsedEmailEvent[] = [outbound, inbound]

const SAMPLE_TEXT = 'A booking confirmation long enough to pass the 30 character minimum check.'

async function parse() {
  fireEvent.changeText(
    screen.getByPlaceholderText(/Paste your booking confirmation here/),
    SAMPLE_TEXT,
  )
  await act(async () => {
    fireEvent.press(screen.getByText('Parse with AI'))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateEvents.mockResolvedValue([])
})

describe('ImportEmailScreen - multi-event preview', () => {
  it('renders a card per parsed event and a plural add-to-trip CTA', async () => {
    mockParse.mockResolvedValueOnce({ events: RYANAIR_EVENTS })
    render(<ImportEmailScreen />)

    await parse()

    expect(screen.getByDisplayValue('Flight FR9266 BVA -> CPH')).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Flight FR9267 CPH -> BVA')).toBeOnTheScreen()
    expect(screen.getByText('Add 2 events to trip')).toBeOnTheScreen()
  })

  it('excludes a toggled-off card from the batch create call', async () => {
    mockParse.mockResolvedValueOnce({ events: RYANAIR_EVENTS })
    render(<ImportEmailScreen />)

    await parse()

    // Toggle the second (inbound) card off, keeping only the outbound flight included.
    fireEvent.press(screen.getByLabelText('Flight FR9267 CPH -> BVA'))
    fireEvent.press(screen.getByText('Add 1 event to trip'))

    await waitFor(() => expect(mockCreateEvents).toHaveBeenCalledTimes(1))
    const [args] = mockCreateEvents.mock.calls[0] as [
      { tripId: string; events: { startsAt: string }[] },
    ]
    expect(args.tripId).toBe('t1')
    expect(args.events).toHaveLength(1)
    expect(args.events[0].startsAt).toBe(new Date(outbound.startsAt as string).toISOString())
  })

  it('shows the empty state and no CTA when the parse finds nothing', async () => {
    mockParse.mockResolvedValueOnce({ events: [] })
    render(<ImportEmailScreen />)

    await parse()

    expect(screen.getByText('No event detected')).toBeOnTheScreen()
    expect(screen.queryByText(/Add \d+ events? to trip/)).toBeNull()
  })
})
