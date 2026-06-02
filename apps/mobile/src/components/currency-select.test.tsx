import { fireEvent, render, screen } from '@testing-library/react-native'

import { CurrencySelect } from './currency-select'

const CURRENCIES = ['EUR', 'USD', 'GBP']

describe('CurrencySelect', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all currency chips', () => {
    render(<CurrencySelect value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />)

    expect(screen.getByText('EUR')).toBeOnTheScreen()
    expect(screen.getByText('USD')).toBeOnTheScreen()
    expect(screen.getByText('GBP')).toBeOnTheScreen()
  })

  it('renders the label when provided', () => {
    render(
      <CurrencySelect label="Currency" value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />,
    )

    expect(screen.getByText('Currency')).toBeOnTheScreen()
  })

  it('does not render a label when not provided', () => {
    render(<CurrencySelect value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />)

    expect(screen.queryByText('Currency')).toBeNull()
  })

  it('calls onChange with the correct currency code when a chip is pressed', () => {
    const onChange = jest.fn()
    render(<CurrencySelect value="EUR" currencies={CURRENCIES} onChange={onChange} />)

    fireEvent.press(screen.getByText('USD'))

    expect(onChange).toHaveBeenCalledWith('USD')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('marks the selected chip with accessibilityState selected=true', () => {
    render(<CurrencySelect value="USD" currencies={CURRENCIES} onChange={jest.fn()} />)

    // getByRole with selected:true finds only the active chip
    expect(screen.getByRole('radio', { name: 'USD', selected: true })).toBeOnTheScreen()
  })

  it('marks non-selected chips with accessibilityState selected=false', () => {
    render(<CurrencySelect value="USD" currencies={CURRENCIES} onChange={jest.fn()} />)

    // EUR is not selected - querying selected:true should not find it
    expect(screen.queryByRole('radio', { name: 'EUR', selected: true })).toBeNull()
  })

  it('calls onChange when the currently selected chip is pressed again', () => {
    const onChange = jest.fn()
    render(<CurrencySelect value="EUR" currencies={CURRENCIES} onChange={onChange} />)

    fireEvent.press(screen.getByText('EUR'))

    expect(onChange).toHaveBeenCalledWith('EUR')
  })

  it('renders correctly with an empty currencies list', () => {
    render(<CurrencySelect value="" currencies={[]} onChange={jest.fn()} />)

    // No chips should be present; component should not crash
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
