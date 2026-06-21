import { fireEvent, render, screen } from '@testing-library/react-native'

import { TripBalanceStrip } from './trip-balance-strip'

describe('TripBalanceStrip', () => {
  it('renders the owe label and amount for a negative balance', () => {
    render(<TripBalanceStrip cents={-4600} currency="EUR" onPress={jest.fn()} />)

    expect(screen.getByText('You owe')).toBeOnTheScreen()
    expect(screen.getByText('46.00 EUR')).toBeOnTheScreen()
  })

  it('renders the owed label and amount for a positive balance', () => {
    render(<TripBalanceStrip cents={1950} currency="EUR" onPress={jest.fn()} />)

    expect(screen.getByText(/owed/)).toBeOnTheScreen()
    expect(screen.getByText('19.50 EUR')).toBeOnTheScreen()
  })

  it('renders the settled label with no amount for a zero balance', () => {
    render(<TripBalanceStrip cents={0} currency="EUR" onPress={jest.fn()} />)

    expect(screen.getByText('All settled up')).toBeOnTheScreen()
    expect(screen.queryByText(/EUR/)).toBeNull()
  })

  it('calls onPress when the strip is pressed', () => {
    const onPress = jest.fn()
    render(<TripBalanceStrip cents={-4600} currency="EUR" onPress={onPress} />)

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
