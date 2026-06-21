import { fireEvent, render, screen } from '@testing-library/react-native'

import { haptics } from '@/lib/haptics'

import { type TripTab, TripTabBar } from './trip-tab-bar'

const TABS: TripTab[] = [
  { name: 'index', label: 'Cockpit', icon: 'albums' },
  { name: 'timeline', label: 'Plan', icon: 'calendar-outline' },
  { name: 'expenses', label: 'Spend', icon: 'wallet-outline' },
  { name: 'pois', label: 'Map', icon: 'map-outline' },
]

function renderBar(props: Partial<Parameters<typeof TripTabBar>[0]> = {}) {
  return render(
    <TripTabBar
      tabs={TABS}
      activeName="index"
      onSelect={jest.fn()}
      onAdd={jest.fn()}
      addLabel="Add to trip"
      {...props}
    />,
  )
}

describe('TripTabBar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders a button for each tab and the centre add action', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'Cockpit' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Plan' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Spend' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Map' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Add to trip' })).toBeOnTheScreen()
  })

  it('marks the active tab as selected and others as not', () => {
    renderBar({ activeName: 'expenses' })

    expect(screen.getByRole('button', { name: 'Spend', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Cockpit', selected: true })).toBeNull()
  })

  it('calls onSelect with the tab name when a tab is pressed', () => {
    const onSelect = jest.fn()
    renderBar({ onSelect })

    fireEvent.press(screen.getByRole('button', { name: 'Map' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('pois')
  })

  it('calls onAdd when the centre add action is pressed', () => {
    const onAdd = jest.fn()
    renderBar({ onAdd })

    fireEvent.press(screen.getByRole('button', { name: 'Add to trip' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('fires a selection haptic on tab press and a light haptic on add', () => {
    const selection = jest.spyOn(haptics, 'selection')
    const light = jest.spyOn(haptics, 'light')
    renderBar()

    fireEvent.press(screen.getByRole('button', { name: 'Plan' }))
    fireEvent.press(screen.getByRole('button', { name: 'Add to trip' }))

    expect(selection).toHaveBeenCalledTimes(1)
    expect(light).toHaveBeenCalledTimes(1)
    selection.mockRestore()
    light.mockRestore()
  })
})
