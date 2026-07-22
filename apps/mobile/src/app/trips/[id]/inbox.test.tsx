import { fireEvent, render, screen } from '@testing-library/react-native'

import type { ImportProposal } from '@/features/inbox'

import InboxScreen from './inbox'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => ({ id: 't1' }),
  useRouter: () => ({ push: mockPush }),
}))

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockRefetch = jest.fn()
const mockUseProposals = jest.fn()
jest.mock('@/features/inbox', () => ({
  useProposals: (tripId: string) => mockUseProposals(tripId),
}))

function makeProposal(overrides: Partial<ImportProposal> = {}): ImportProposal {
  return {
    id: 'p1',
    trip_id: 't1',
    status: 'pending',
    source: 'email',
    sender_email: 'booking@airline.example.com',
    subject: 'Flight ZY123 confirmation',
    events: [
      {
        category: 'transport',
        subcategory: 'transport.flight',
        title: 'Flight ZY123 CDG -> OSL',
        startsAt: '2026-07-10T08:20:00Z',
        endsAt: null,
        location: null,
        gateLocation: null,
        endLocation: null,
        participants: [],
        notes: null,
        currency: null,
        priceCents: null,
        confidence: 0.9,
      },
    ],
    received_at: '2026-07-05T12:00:00Z',
    created_at: '2026-07-05T12:00:01Z',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('InboxScreen', () => {
  it('shows a loading spinner while the query is pending', () => {
    mockUseProposals.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.queryByText('Nothing to review')).not.toBeOnTheScreen()
  })

  it('shows a retryable error state when the query fails', () => {
    mockUseProposals.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    fireEvent.press(screen.getByText('Try again'))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there is nothing to review', () => {
    mockUseProposals.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.getByText('Nothing to review')).toBeOnTheScreen()
  })

  it('filters out settled proposals, listing only pending/parsing/failed', () => {
    mockUseProposals.mockReturnValue({
      data: [makeProposal(), makeProposal({ id: 'p2', status: 'validated' })],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.getByText('Flight ZY123 confirmation')).toBeOnTheScreen()
  })

  it('opens a reviewable pending proposal on press', () => {
    mockUseProposals.mockReturnValue({
      data: [makeProposal()],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    fireEvent.press(screen.getByText('Flight ZY123 confirmation'))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/trips/[id]/inbox/[proposalId]',
      params: { id: 't1', proposalId: 'p1' },
    })
  })

  it('shows "nothing extracted" for a failed proposal and does not make it tappable', () => {
    mockUseProposals.mockReturnValue({
      data: [makeProposal({ status: 'failed', events: null })],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.getByText('Nothing extracted')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Flight ZY123 confirmation'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the analysing state for a parsing proposal without making it tappable', () => {
    mockUseProposals.mockReturnValue({
      data: [makeProposal({ status: 'parsing' })],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.getByText('Analysing…')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Flight ZY123 confirmation'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('falls back to a placeholder for a proposal with no subject', () => {
    mockUseProposals.mockReturnValue({
      data: [makeProposal({ subject: null })],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    })
    render(<InboxScreen />)

    expect(screen.getByText('(no subject)')).toBeOnTheScreen()
  })
})
