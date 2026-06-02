import { fireEvent, render, screen } from '@testing-library/react-native'

import { Segmented } from './segmented'

const OPTIONS = [
  { label: 'Expenses', value: 'expenses' },
  { label: 'Balances', value: 'balances' },
  { label: 'Map', value: 'map' },
]

describe('Segmented', () => {
  it('renders all option labels', () => {
    render(<Segmented options={OPTIONS} value="expenses" onChange={() => {}} />)

    expect(screen.getByText('Expenses')).toBeOnTheScreen()
    expect(screen.getByText('Balances')).toBeOnTheScreen()
    expect(screen.getByText('Map')).toBeOnTheScreen()
  })

  it('calls onChange with the value of the pressed inactive option', () => {
    const onChange = jest.fn()
    render(<Segmented options={OPTIONS} value="expenses" onChange={onChange} />)

    fireEvent.press(screen.getByText('Balances'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('balances')
  })

  it('does not call onChange when the already-active option is pressed', () => {
    const onChange = jest.fn()
    render(<Segmented options={OPTIONS} value="expenses" onChange={onChange} />)

    fireEvent.press(screen.getByText('Expenses'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders without throwing for any valid value', () => {
    expect(() =>
      render(<Segmented options={OPTIONS} value="map" onChange={() => {}} />),
    ).not.toThrow()
  })
})
