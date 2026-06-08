import { fireEvent, render, screen } from '@testing-library/react-native'

import { UNASSIGNED_FILTER } from '@/features/packing'

import { TravelerFilter } from './traveler-filter'

const members = [
  { id: 'm1', display_name: 'Ana' },
  { id: 'm2', display_name: null },
]

describe('TravelerFilter', () => {
  it('renders Everyone, a chip per member, and Unassigned', () => {
    render(<TravelerFilter members={members} selected={null} onChange={() => undefined} />)
    expect(screen.getByText('Everyone')).toBeOnTheScreen()
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByText('Unassigned')).toBeOnTheScreen()
  })

  it('calls onChange with the member id, the sentinel, and null', () => {
    const onChange = jest.fn()
    render(<TravelerFilter members={members} selected="m1" onChange={onChange} />)

    fireEvent.press(screen.getByText('Ana'))
    expect(onChange).toHaveBeenCalledWith('m1')

    fireEvent.press(screen.getByText('Unassigned'))
    expect(onChange).toHaveBeenCalledWith(UNASSIGNED_FILTER)

    fireEvent.press(screen.getByText('Everyone'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
