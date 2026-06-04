import { fireEvent, render, screen } from '@testing-library/react-native'

import { type FloatingTab, type FloatingTabAction, FloatingTabBar } from './floating-tab-bar'

const TABS: FloatingTab[] = [
  { key: 'home', name: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'trips', name: 'trips', label: 'Trips', icon: 'airplane-outline' },
  { key: 'profile', name: 'profile', label: 'Profile', icon: 'person-outline' },
]

describe('FloatingTabBar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when there are no tabs and no solo action', () => {
    render(<FloatingTabBar tabs={[]} activeName="index" onSelect={jest.fn()} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a button for every tab', () => {
    render(<FloatingTabBar tabs={TABS} activeName="index" onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Home' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Trips' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeOnTheScreen()
  })

  it('marks the active tab as selected and others as not selected', () => {
    render(<FloatingTabBar tabs={TABS} activeName="trips" onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Trips', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Home', selected: true })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Profile', selected: true })).toBeNull()
  })

  it('renders the active tab label text and hides inactive labels', () => {
    // The label Text is only rendered for the active pill (active ? <Text/> : null).
    render(<FloatingTabBar tabs={TABS} activeName="index" onSelect={jest.fn()} />)

    expect(screen.getByText('Home')).toBeOnTheScreen()
    expect(screen.queryByText('Trips')).toBeNull()
    expect(screen.queryByText('Profile')).toBeNull()
  })

  it('calls onSelect with the tab name when a left-group tab is pressed', () => {
    const onSelect = jest.fn()
    render(<FloatingTabBar tabs={TABS} activeName="index" onSelect={onSelect} />)

    fireEvent.press(screen.getByRole('button', { name: 'Trips' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('trips')
  })

  it('calls onSelect with the tab name when the right (solo) tab is pressed', () => {
    // Without a soloAction, the last tab becomes the standalone right pill.
    const onSelect = jest.fn()
    render(<FloatingTabBar tabs={TABS} activeName="index" onSelect={onSelect} />)

    fireEvent.press(screen.getByRole('button', { name: 'Profile' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('profile')
  })

  it('renders the right tab as selected when it is the active tab', () => {
    // Exercises the right-pill active branch (active styling + selected state).
    render(<FloatingTabBar tabs={TABS} activeName="profile" onSelect={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Profile', selected: true })).toBeOnTheScreen()
    expect(screen.getByText('Profile')).toBeOnTheScreen()
  })

  it('renders a single tab as the right pill with no left group', () => {
    // One tab: leftTabs is empty (slice(0, -1) === []), so only the right pill renders.
    const onSelect = jest.fn()
    const single: FloatingTab[] = [
      { key: 'home', name: 'index', label: 'Home', icon: 'home-outline' },
    ]
    render(<FloatingTabBar tabs={single} activeName="index" onSelect={onSelect} />)

    fireEvent.press(screen.getByRole('button', { name: 'Home' }))

    expect(onSelect).toHaveBeenCalledWith('index')
  })

  describe('with a solo action', () => {
    const soloAction: FloatingTabAction = {
      label: 'Ask Zo',
      icon: 'sparkles-outline',
      onPress: jest.fn(),
    }

    it('puts every tab in the left group and renders the solo action pill', () => {
      render(
        <FloatingTabBar
          tabs={TABS}
          activeName="index"
          onSelect={jest.fn()}
          soloAction={soloAction}
        />,
      )

      // All three tabs are now left-group buttons (none promoted to the right pill).
      expect(screen.getByRole('button', { name: 'Home' })).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Trips' })).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Profile' })).toBeOnTheScreen()
      // The solo action renders its own button + always-visible label.
      expect(screen.getByRole('button', { name: 'Ask Zo' })).toBeOnTheScreen()
      expect(screen.getByText('Ask Zo')).toBeOnTheScreen()
    })

    it('calls soloAction.onPress when the action pill is pressed', () => {
      render(
        <FloatingTabBar
          tabs={TABS}
          activeName="index"
          onSelect={jest.fn()}
          soloAction={soloAction}
        />,
      )

      fireEvent.press(screen.getByRole('button', { name: 'Ask Zo' }))

      expect(soloAction.onPress).toHaveBeenCalledTimes(1)
    })

    it('still calls onSelect for a left-group tab while a solo action is present', () => {
      const onSelect = jest.fn()
      render(
        <FloatingTabBar
          tabs={TABS}
          activeName="index"
          onSelect={onSelect}
          soloAction={soloAction}
        />,
      )

      fireEvent.press(screen.getByRole('button', { name: 'Profile' }))

      expect(onSelect).toHaveBeenCalledWith('profile')
    })

    it('renders only the solo action when there are no tabs', () => {
      // tabs empty but soloAction present: the early return is skipped and leftTabs is empty,
      // so just the action pill renders.
      render(
        <FloatingTabBar tabs={[]} activeName="" onSelect={jest.fn()} soloAction={soloAction} />,
      )

      expect(screen.getByRole('button', { name: 'Ask Zo' })).toBeOnTheScreen()
    })
  })
})
