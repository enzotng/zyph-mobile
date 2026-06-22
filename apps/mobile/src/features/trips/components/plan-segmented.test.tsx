import { fireEvent, render, screen } from '@testing-library/react-native'

import { PlanSegmented } from './plan-segmented'

const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}))

describe('PlanSegmented', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('renders both segments', () => {
    render(<PlanSegmented active="timeline" tripId="t1" />)

    expect(screen.getByText('Timeline')).toBeOnTheScreen()
    expect(screen.getByText('Packing')).toBeOnTheScreen()
  })

  it('marks the active segment as selected', () => {
    render(<PlanSegmented active="timeline" tripId="t1" />)

    expect(screen.getByRole('button', { name: 'Timeline', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Packing', selected: true })).toBeNull()
  })

  it('navigates to the packing route when the packing segment is pressed', () => {
    render(<PlanSegmented active="timeline" tripId="t1" />)

    fireEvent.press(screen.getByRole('button', { name: 'Packing' }))

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/trips/[id]/packing',
      params: { id: 't1' },
    })
  })

  it('does not navigate when pressing the already-active segment', () => {
    render(<PlanSegmented active="timeline" tripId="t1" />)

    fireEvent.press(screen.getByRole('button', { name: 'Timeline' }))

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
