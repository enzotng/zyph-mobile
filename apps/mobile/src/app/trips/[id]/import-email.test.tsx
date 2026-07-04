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

// Two fictional active members plus one removed member that must never render as a chip - proves
// the screen's own active/user_id filter, not just the (already-active-only) query.
jest.mock('@/features/group', () => ({
  useTripMembers: () => ({
    data: [
      {
        id: 'm1',
        user_id: 'u1',
        role: 'member',
        status: 'active',
        display_name: 'Zoe Tran',
        avatar_url: null,
      },
      {
        id: 'm2',
        user_id: 'u2',
        role: 'member',
        status: 'active',
        display_name: 'Marc-Antoine Dupont',
        avatar_url: null,
      },
      {
        id: 'm3',
        user_id: 'u3',
        role: 'member',
        status: 'removed',
        display_name: 'Lea Petit',
        avatar_url: null,
      },
    ],
  }),
}))

// A fictional round-trip (two legs, distinct realistic datetimes) matching the API regression
// same base fields, distinct titles + real dates.
const validEvent: ParsedEmailEvent = {
  type: 'flight',
  title: 'AF1234 Paris -> Rome',
  startsAt: '2026-06-10T08:00:00Z',
  endsAt: '2026-06-10T10:00:00Z',
  location: { name: 'Charles de Gaulle', lat: 49.0097, lng: 2.5479 },
  gateLocation: { label: 'Gate K12', lat: 49.0097, lng: 2.5479 },
  endLocation: null,
  participants: [],
  notes: 'Window seat',
  currency: 'EUR',
  priceCents: 12_000,
  confidence: 0.9,
}
const outbound: ParsedEmailEvent = {
  ...validEvent,
  title: 'Flight ZY123 CDG -> OSL',
  startsAt: '2026-07-10T08:20:00+02:00',
  endsAt: '2026-07-10T10:35:00+02:00',
  location: { name: 'Paris Charles de Gaulle Airport', lat: 49.0097, lng: 2.5479 },
  endLocation: { name: 'Oslo Airport', lat: 60.1976, lng: 11.1004 },
}
const inbound: ParsedEmailEvent = {
  ...validEvent,
  title: 'Flight ZY124 OSL -> CDG',
  startsAt: '2026-07-24T20:05:00+02:00',
  endsAt: '2026-07-24T22:20:00+02:00',
}
const ROUND_TRIP_EVENTS: ParsedEmailEvent[] = [outbound, inbound]

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
    mockParse.mockResolvedValueOnce({ events: ROUND_TRIP_EVENTS })
    render(<ImportEmailScreen />)

    await parse()

    expect(screen.getByDisplayValue('Flight ZY123 CDG -> OSL')).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Flight ZY124 OSL -> CDG')).toBeOnTheScreen()
    expect(screen.getByText('Add 2 events to trip')).toBeOnTheScreen()
  })

  it('excludes a toggled-off card from the batch create call', async () => {
    mockParse.mockResolvedValueOnce({ events: ROUND_TRIP_EVENTS })
    render(<ImportEmailScreen />)

    await parse()

    // Toggle the second (inbound) card off, keeping only the outbound flight included.
    fireEvent.press(screen.getByLabelText('Flight ZY124 OSL -> CDG'))
    fireEvent.press(screen.getByText('Add 1 event to trip'))

    await waitFor(() => expect(mockCreateEvents).toHaveBeenCalledTimes(1))
    const [args] = mockCreateEvents.mock.calls[0] as [
      {
        tripId: string
        events: {
          startsAt: string
          locationName: string | null
          endLocation: { name: string; lat: number | null; lng: number | null } | null
          participants: string[] | null
        }[]
      },
    ]
    expect(args.tripId).toBe('t1')
    expect(args.events).toHaveLength(1)
    expect(args.events[0].startsAt).toBe(new Date(outbound.startsAt as string).toISOString())
    expect(args.events[0].locationName).toBe('Paris Charles de Gaulle Airport')
    expect(args.events[0].endLocation).toEqual({
      name: 'Oslo Airport',
      lat: 60.1976,
      lng: 11.1004,
    })
    // No passenger names were parsed (participants: []), so the row sends the "everyone" sentinel.
    expect(args.events[0].participants).toBeNull()
  })

  it('shows the empty state and no CTA when the parse finds nothing', async () => {
    mockParse.mockResolvedValueOnce({ events: [] })
    render(<ImportEmailScreen />)

    await parse()

    expect(screen.getByText('No event detected')).toBeOnTheScreen()
    expect(screen.queryByText(/Add \d+ events? to trip/)).toBeNull()
  })
})

// `Avatar` (components/ui/avatar.tsx) sets its own accessibilityLabel from the `name` it is given,
// so each chip's Avatar carries the SAME label as its wrapping Pressable (the checkbox) - the same
// double-label shape already present in attribute-expense.tsx's MemberAvatar. getByLabelText alone
// is therefore ambiguous; getByRole('checkbox', { name }) is unambiguous, since only the wrapping
// Pressable (not the inner Avatar) carries accessibilityRole="checkbox".
function participantChip(name: string) {
  return screen.getByRole('checkbox', { name })
}

describe('ImportEmailScreen - participant chips', () => {
  it('preselects the matching member chip and sends only that id', async () => {
    mockParse.mockResolvedValueOnce({
      events: [{ ...validEvent, participants: ['Zoe Ngoc Mai Tran'] }],
    })
    render(<ImportEmailScreen />)

    await parse()

    expect(participantChip('Zoe Tran').props.accessibilityState).toEqual({ checked: true })
    expect(participantChip('Marc-Antoine Dupont').props.accessibilityState).toEqual({
      checked: false,
    })
    // The removed member never renders a chip at all.
    expect(screen.queryByRole('checkbox', { name: 'Lea Petit' })).toBeNull()

    fireEvent.press(screen.getByText('Add 1 event to trip'))

    await waitFor(() => expect(mockCreateEvents).toHaveBeenCalledTimes(1))
    const [args] = mockCreateEvents.mock.calls[0] as [
      { events: { participants: string[] | null }[] },
    ]
    expect(args.events[0].participants).toEqual(['u1'])
  })

  it('toggling a member off from the everyone state sends the remaining active ids', async () => {
    mockParse.mockResolvedValueOnce({ events: [validEvent] })
    render(<ImportEmailScreen />)

    await parse()

    // Everyone is selected by default (no passenger names parsed) - both chips start checked.
    expect(participantChip('Zoe Tran').props.accessibilityState).toEqual({ checked: true })
    expect(participantChip('Marc-Antoine Dupont').props.accessibilityState).toEqual({
      checked: true,
    })

    fireEvent.press(participantChip('Zoe Tran'))

    expect(participantChip('Zoe Tran').props.accessibilityState).toEqual({ checked: false })
    fireEvent.press(screen.getByText('Add 1 event to trip'))

    await waitFor(() => expect(mockCreateEvents).toHaveBeenCalledTimes(1))
    const [args] = mockCreateEvents.mock.calls[0] as [
      { events: { participants: string[] | null }[] },
    ]
    expect(args.events[0].participants).toEqual(['u2'])
  })
})
