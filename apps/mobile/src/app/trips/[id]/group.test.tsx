import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

import TripGroupScreen from './group'

const mockUseTripMembers = jest.fn()
const mockUseTrip = jest.fn()
const mockUseAuth = jest.fn()
const mockAddGhost = jest.fn()
const mockRenameGhost = jest.fn()
const mockDetach = jest.fn()
const mockRemove = jest.fn()

jest.mock('@/lib/supabase')

jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => ({ id: 't1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('expo-linking', () => ({ createURL: () => 'zyph://trips/join?code=abc123' }))

jest.mock('@/lib/preferences', () => ({
  getShareLocation: () => false,
  setShareLocation: jest.fn(),
}))

jest.mock('@/features/wayfinder', () => ({ useShareLocation: () => ({ status: 'idle' }) }))

jest.mock('@/features/auth', () => ({ useAuth: () => mockUseAuth() }))

jest.mock('@/features/trips', () => ({
  ...jest.requireActual('@/features/trips'),
  useTrip: () => mockUseTrip(),
}))

jest.mock('@/features/group', () => ({
  ...jest.requireActual('@/features/group'),
  useTripMembers: () => mockUseTripMembers(),
  useTripAdminActions: () => ({
    confirmRegenerate: jest.fn(),
    confirmDelete: jest.fn(),
    confirmLeave: jest.fn(),
    isRegenerating: false,
    isDeleting: false,
    isLeaving: false,
  }),
  useAddGhostMember: () => ({ mutateAsync: mockAddGhost, isPending: false }),
  useRenameGhostMember: () => ({ mutateAsync: mockRenameGhost, isPending: false }),
  useDetachTripMember: () => ({ mutateAsync: mockDetach, isPending: false }),
  useRemoveTripMember: () => ({ mutateAsync: mockRemove, isPending: false }),
}))

const OWNER = {
  id: 'm-owner',
  user_id: 'u-owner',
  display_name: 'Marco',
  role: 'owner',
  avatar_url: null,
}
const CLAIMED = {
  id: 'm-lea',
  user_id: 'u-lea',
  display_name: 'Léa',
  role: 'member',
  avatar_url: null,
}
// A second claimed member, so the non-owner assertions below have a row that is neither the
// viewer's own (which renders as "You") nor a ghost.
const NINA = {
  id: 'm-nina',
  user_id: 'u-nina',
  display_name: 'Nina',
  role: 'member',
  avatar_url: null,
}
const GHOST = {
  id: 'm-ghost',
  user_id: null,
  display_name: 'Papa',
  role: 'member',
  avatar_url: null,
}

// Runs the button of a native Alert by its visible label - the screen's menus are Alerts.
function pressAlertButton(label: string) {
  const calls = jest.mocked(Alert.alert).mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    const buttons = calls[i][2] as { text?: string; onPress?: () => void }[] | undefined
    const button = buttons?.find((b) => b.text === label)
    if (button?.onPress) {
      button.onPress()
      return
    }
  }
  throw new Error(`No alert button labelled "${label}". Alerts: ${JSON.stringify(calls)}`)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAuth.mockReturnValue({ session: { user: { id: 'u-owner' } } })
  mockUseTrip.mockReturnValue({
    data: { id: 't1', title: 'Lisbonne', invite_code: 'abc123', owner_id: 'u-owner' },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockUseTripMembers.mockReturnValue({
    data: [OWNER, CLAIMED, NINA, GHOST],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })
  mockAddGhost.mockResolvedValue('m-new')
  mockRenameGhost.mockResolvedValue(undefined)
  mockDetach.mockResolvedValue(undefined)
  mockRemove.mockResolvedValue(undefined)
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('TripGroupScreen - telling places from people', () => {
  it('badges a place nobody has claimed, and only that one', () => {
    render(<TripGroupScreen />)

    expect(screen.getByText('Has not joined yet')).toBeOnTheScreen()
    expect(screen.getAllByText('Has not joined yet')).toHaveLength(1)
  })

  it('counts places and people alike', () => {
    render(<TripGroupScreen />)

    expect(screen.getByText('4')).toBeOnTheScreen()
  })
})

describe('TripGroupScreen - managing a place', () => {
  it('renames it', async () => {
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Papa'))
    await act(async () => {
      pressAlertButton('Rename')
    })

    // Opens on the name it is about to change, not on an empty field.
    expect(screen.getByPlaceholderText('First name').props.value).toBe('Papa')
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Papy')
    await act(async () => {
      fireEvent.press(screen.getByText('Save'))
    })

    expect(mockRenameGhost).toHaveBeenCalledWith({ memberId: 'm-ghost', name: 'Papy' })
  })

  it('adds a new one', async () => {
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByText('Add a participant'))
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Léo')
    await act(async () => {
      fireEvent.press(screen.getByText('Save'))
    })

    expect(mockAddGhost).toHaveBeenCalledWith('Léo')
  })

  it('says so when a rename is refused, rather than looking like it landed', async () => {
    mockRenameGhost.mockRejectedValue(new Error('not a renamable ghost'))
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Papa'))
    await act(async () => {
      pressAlertButton('Rename')
    })
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Papy')
    await act(async () => {
      fireEvent.press(screen.getByText('Save'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Could not rename', 'not a renamable ghost')
  })

  it('offers to remind through the share sheet', () => {
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Papa'))

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as { text?: string }[]
    expect(buttons.map((b) => b.text)).toEqual(
      expect.arrayContaining(['Remind', 'Rename', 'Remove']),
    )
  })
})

describe('TripGroupScreen - detaching a claimed place', () => {
  it('asks first, then unbinds the account', async () => {
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Léa'))
    pressAlertButton('Free up the place')
    await act(async () => {
      pressAlertButton('Free up the place')
    })

    expect(mockDetach).toHaveBeenCalledWith('m-lea')
  })

  // The server decides, not the client: no balance is pre-computed here, the guard's own message
  // is what routes to the fallback (spec 4.6).
  it('falls back to removal when the place moved the ledger since the claim', async () => {
    mockDetach.mockRejectedValue(
      new Error('place has ledger activity since claim; remove the member instead'),
    )
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Léa'))
    pressAlertButton('Free up the place')
    await act(async () => {
      pressAlertButton('Free up the place')
    })

    await waitFor(() => expect(screen.queryByText('Léa')).toBeTruthy())
    await act(async () => {
      pressAlertButton('Remove')
    })

    expect(mockRemove).toHaveBeenCalledWith('m-lea')
  })

  it('does not offer removal for an unrelated failure', async () => {
    mockDetach.mockRejectedValue(new Error('owner only'))
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Léa'))
    pressAlertButton('Free up the place')
    await act(async () => {
      pressAlertButton('Free up the place')
    })

    const lastCall = jest.mocked(Alert.alert).mock.calls.at(-1)
    expect(lastCall?.[1]).toContain('owner only')
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('gives a non-owner no hold over a claimed place, including their own', () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u-lea' } } })
    render(<TripGroupScreen />)

    // Nina's row is the load-bearing one: Léa's own row renders as "You", so asserting on it
    // would hold under any implementation.
    expect(screen.queryByLabelText('Manage Nina')).toBeNull()
    expect(screen.queryByLabelText('Manage You')).toBeNull()
    expect(screen.queryByLabelText('Manage Marco')).toBeNull()
  })

  // D8: a place nobody holds belongs to the whole trip, not to the owner. Removing it does not.
  it('lets a non-owner tend a ghost place but not remove it', () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u-lea' } } })
    render(<TripGroupScreen />)

    fireEvent.press(screen.getByLabelText('Manage Papa'))

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as { text?: string }[]
    const labels = buttons.map((b) => b.text)
    expect(labels).toEqual(expect.arrayContaining(['Remind', 'Rename']))
    expect(labels).not.toContain('Remove')
  })

  it('never offers the owner a hold over their own row', () => {
    render(<TripGroupScreen />)

    expect(screen.queryByLabelText('Manage You')).toBeNull()
  })
})
