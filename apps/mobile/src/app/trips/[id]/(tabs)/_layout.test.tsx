import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import TripTabsLayout from './_layout'

// Render Ionicons as a host stub so the async font load never fires a post-teardown setState.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
const mockNavigate = jest.fn()
const mockEmit = jest.fn(() => ({ defaultPrevented: false }))

// Minimal state/descriptors/navigation triple: the layout only reads `state.routes`,
// `state.index`, `descriptors[key].options.title`, and `navigation.emit`/`navigate`.
const mockTabProps = {
  state: {
    index: 0,
    routes: [
      { key: 'index-key', name: 'index' },
      { key: 'timeline-key', name: 'timeline' },
      { key: 'expenses-key', name: 'expenses' },
    ],
  },
  descriptors: {
    'index-key': { options: { title: 'Cockpit' } },
    'timeline-key': { options: { title: 'Plan' } },
    'expenses-key': { options: { title: 'Spend' } },
  },
  navigation: {
    emit: mockEmit,
    navigate: mockNavigate,
  },
}

jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ tabBar }: { tabBar: (p: unknown) => ReactNode }) => tabBar(mockTabProps), {
    Screen: () => null,
  }),
  useGlobalSearchParams: () => ({ id: 'trip-1' }),
  useRouter: () => ({ push: mockPush }),
}))

describe('TripTabsLayout', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockNavigate.mockClear()
    mockEmit.mockClear()
  })

  it('pushes the immersive map instead of switching tabs', () => {
    render(<TripTabsLayout />)
    fireEvent.press(screen.getByLabelText('Map'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/trips/[id]/pois',
      params: { id: 'trip-1' },
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('switches to a real tab via navigation.navigate instead of pushing', () => {
    render(<TripTabsLayout />)
    fireEvent.press(screen.getByLabelText('Plan'))
    expect(mockNavigate).toHaveBeenCalledWith('timeline')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('never marks the Map button as the active tab', () => {
    render(<TripTabsLayout />)
    expect(screen.queryByRole('tab', { name: 'Map', selected: true })).toBeNull()
  })
})
