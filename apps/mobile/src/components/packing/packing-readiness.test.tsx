import { fireEvent, render, screen } from '@testing-library/react-native'

import type { MemberProgress } from '@/features/packing'

import { PackingReadiness } from './packing-readiness'

const progress: MemberProgress[] = [
  { memberId: 'm1', name: 'Ana', assigned: 4, packed: 3 },
  { memberId: 'm2', name: null, assigned: 2, packed: 2 },
]

describe('PackingReadiness', () => {
  it('shows the ready state when everything is packed and assigned', () => {
    render(<PackingReadiness progress={[]} unassignedCount={0} readyPercent={100} />)
    expect(screen.getByText('Everyone is packed')).toBeOnTheScreen()
  })

  it('shows the percent, member ratios and the to-assign footer when not ready', () => {
    render(<PackingReadiness progress={progress} unassignedCount={2} readyPercent={60} />)
    expect(screen.getByText('Group is 60% ready')).toBeOnTheScreen()
    expect(screen.getByText('3/4')).toBeOnTheScreen()
    expect(screen.getByText('2/2')).toBeOnTheScreen()
    expect(screen.getByText('2 items to assign')).toBeOnTheScreen()
  })

  it('calls onPressMember when a member row is tapped', () => {
    const onPressMember = jest.fn()
    render(
      <PackingReadiness
        progress={[{ memberId: 'm1', name: 'Ana', assigned: 2, packed: 1 }]}
        unassignedCount={0}
        readyPercent={50}
        onPressMember={onPressMember}
      />,
    )
    fireEvent.press(screen.getByRole('button'))
    expect(onPressMember).toHaveBeenCalledWith('m1')
  })
})
