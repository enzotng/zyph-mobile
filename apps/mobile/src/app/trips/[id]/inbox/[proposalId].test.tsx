import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

import type { ImportProposal } from '@/features/inbox'

import InboxProposalScreen from './[proposalId]'

jest.mock('@/lib/supabase')

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => ({ id: 't1', proposalId: 'p1' }),
  useRouter: () => ({ back: mockBack }),
}))

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// Host stub for the native date picker inside DateField (rendered by the real EventPreviewCard).
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker')

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
    ],
  }),
}))

const mockValidateMutate = jest.fn<Promise<void>, [{ proposalId: string; events: unknown[] }]>()
const mockRejectMutate = jest.fn<Promise<void>, [string]>()
const mockUseProposals = jest.fn()

jest.mock('@/features/inbox', () => ({
  useProposals: () => mockUseProposals(),
  useValidateProposal: () => ({ mutateAsync: mockValidateMutate, isPending: false }),
  useRejectProposal: () => ({ mutateAsync: mockRejectMutate, isPending: false }),
}))

const PROPOSAL: ImportProposal = {
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
      endsAt: '2026-07-10T10:35:00Z',
      location: { name: 'Paris Charles de Gaulle Airport', lat: 49.0097, lng: 2.5479 },
      gateLocation: null,
      endLocation: { name: 'Oslo Airport', lat: 60.1976, lng: 11.1004 },
      participants: [],
      notes: null,
      currency: null,
      priceCents: null,
      confidence: 0.9,
    },
  ],
  received_at: '2026-07-05T12:00:00Z',
  created_at: '2026-07-05T12:00:01Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockValidateMutate.mockResolvedValue(undefined)
  mockRejectMutate.mockResolvedValue(undefined)
  mockUseProposals.mockReturnValue({ data: [PROPOSAL], isLoading: false })
})

describe('InboxProposalScreen', () => {
  it('shows not-found when no proposal matches the route param', () => {
    mockUseProposals.mockReturnValue({ data: [], isLoading: false })
    render(<InboxProposalScreen />)

    expect(screen.getByText('Proposal not found.')).toBeOnTheScreen()
  })

  it('renders the permanent security banner with the full sender address', () => {
    render(<InboxProposalScreen />)

    expect(screen.getByText('External content')).toBeOnTheScreen()
    expect(screen.getByText('From booking@airline.example.com')).toBeOnTheScreen()
  })

  it('maps the proposal events to editable preview cards', () => {
    render(<InboxProposalScreen />)

    expect(screen.getByDisplayValue('Flight ZY123 CDG -> OSL')).toBeOnTheScreen()
  })

  it('validates with the resolved (participants-matched, capped) events shape', async () => {
    render(<InboxProposalScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Add to timeline'))
    })

    await waitFor(() => expect(mockValidateMutate).toHaveBeenCalledTimes(1))
    const [args] = mockValidateMutate.mock.calls[0]
    expect(args.proposalId).toBe('p1')
    expect(args.events).toHaveLength(1)
    expect(args.events[0]).toMatchObject({
      title: 'Flight ZY123 CDG -> OSL',
      locationName: 'Paris Charles de Gaulle Airport',
      participants: null,
    })
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('rejects the proposal once the confirm alert is accepted', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      const confirm = buttons?.find((button) => button.text === 'Reject')
      confirm?.onPress?.()
    })
    render(<InboxProposalScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Reject'))
    })

    await waitFor(() => expect(mockRejectMutate).toHaveBeenCalledWith('p1'))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('cancelling the reject confirm does not call the mutation', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      const cancel = buttons?.find((button) => button.text === 'Cancel')
      cancel?.onPress?.()
    })
    render(<InboxProposalScreen />)

    fireEvent.press(screen.getByText('Reject'))

    expect(mockRejectMutate).not.toHaveBeenCalled()
  })

  it('shows a friendly alert and never navigates back when validation fails', async () => {
    mockValidateMutate.mockRejectedValueOnce(new Error('rpc failed'))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<InboxProposalScreen />)

    await act(async () => {
      fireEvent.press(screen.getByText('Add to timeline'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Could not add these events', 'Please try again.')
    expect(mockBack).not.toHaveBeenCalled()
  })
})
