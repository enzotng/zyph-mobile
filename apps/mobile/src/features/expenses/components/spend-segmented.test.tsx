import { fireEvent, render, screen } from '@testing-library/react-native'

import { SpendSegmented } from './spend-segmented'

const mockOnChange = jest.fn()

describe('SpendSegmented', () => {
  beforeEach(() => mockOnChange.mockClear())

  it('renders all three segments', () => {
    render(<SpendSegmented value="expenses" onChange={mockOnChange} />)

    expect(screen.getByText('Spend')).toBeOnTheScreen()
    expect(screen.getByText('Balances')).toBeOnTheScreen()
    expect(screen.getByText('Stats')).toBeOnTheScreen()
  })

  it('marks the active segment as selected', () => {
    render(<SpendSegmented value="expenses" onChange={mockOnChange} />)

    expect(screen.getByRole('button', { name: 'Spend', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Balances', selected: true })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stats', selected: true })).toBeNull()
  })

  it('calls onChange with the tapped value instead of navigating', () => {
    render(<SpendSegmented value="expenses" onChange={mockOnChange} />)

    fireEvent.press(screen.getByRole('button', { name: 'Balances' }))

    expect(mockOnChange).toHaveBeenCalledWith('balances')
  })

  it('does not call onChange when pressing the already-active segment', () => {
    render(<SpendSegmented value="expenses" onChange={mockOnChange} />)

    fireEvent.press(screen.getByRole('button', { name: 'Spend' }))

    expect(mockOnChange).not.toHaveBeenCalled()
  })
})
