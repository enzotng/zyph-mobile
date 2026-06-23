import { fireEvent, render, screen } from '@testing-library/react-native'

import { haptics } from '@/lib/haptics'

import { type AppTab, AppTabBar } from './app-tab-bar'

const TABS: AppTab[] = [
  { name: 'index', label: 'Home', icon: 'albums' },
  { name: 'profile', label: 'Profile', icon: 'person-outline' },
]

function renderBar(props: Partial<Parameters<typeof AppTabBar>[0]> = {}) {
  return render(
    <AppTabBar
      tabs={TABS}
      activeName="index"
      onSelect={jest.fn()}
      onAdd={jest.fn()}
      addLabel="New trip"
      {...props}
    />,
  )
}

describe('AppTabBar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders a tab for each tab and the add action', () => {
    renderBar()

    expect(screen.getByRole('tab', { name: 'Home' })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'New trip' })).toBeOnTheScreen()
  })

  it('marks the active tab as selected and others as not', () => {
    renderBar({ activeName: 'profile' })

    expect(screen.getByRole('tab', { name: 'Profile', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('tab', { name: 'Home', selected: true })).toBeNull()
  })

  it('calls onSelect with the tab name when a tab is pressed', () => {
    const onSelect = jest.fn()
    renderBar({ onSelect })

    fireEvent.press(screen.getByRole('tab', { name: 'Profile' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('profile')
  })

  it('calls onAdd when the centre add action is pressed', () => {
    const onAdd = jest.fn()
    renderBar({ onAdd })

    fireEvent.press(screen.getByRole('button', { name: 'New trip' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('fires a selection haptic on tab press and a light haptic on add', () => {
    const selection = jest.spyOn(haptics, 'selection')
    const light = jest.spyOn(haptics, 'light')
    renderBar()

    fireEvent.press(screen.getByRole('tab', { name: 'Profile' }))
    fireEvent.press(screen.getByRole('button', { name: 'New trip' }))

    expect(selection).toHaveBeenCalledTimes(1)
    expect(light).toHaveBeenCalledTimes(1)
    selection.mockRestore()
    light.mockRestore()
  })
})
