import { fireEvent, render, screen } from '@testing-library/react-native'

import { CurrencyPicker } from './currency-picker'

const CURRENCIES = ['EUR', 'USD', 'GBP']

describe('CurrencyPicker', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the selected currency code and localized name in the field', () => {
    render(<CurrencyPicker value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />)
    expect(screen.getByText('EUR')).toBeOnTheScreen()
    expect(screen.getByText(/Euro/i)).toBeOnTheScreen()
  })

  it('renders the label when provided', () => {
    render(
      <CurrencyPicker label="Currency" value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />,
    )
    expect(screen.getByText('Currency')).toBeOnTheScreen()
  })

  it('opens the sheet and marks the selected currency as a checked radio', () => {
    render(<CurrencyPicker value="USD" currencies={CURRENCIES} onChange={jest.fn()} />)
    fireEvent.press(screen.getByRole('button'))
    expect(screen.getByRole('radio', { name: 'USD', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'EUR', selected: true })).toBeNull()
  })

  it('calls onChange when a currency is picked from the sheet', () => {
    const onChange = jest.fn()
    render(<CurrencyPicker value="EUR" currencies={CURRENCIES} onChange={onChange} />)
    fireEvent.press(screen.getByRole('button'))
    fireEvent.press(screen.getByRole('radio', { name: 'GBP' }))
    expect(onChange).toHaveBeenCalledWith('GBP')
  })

  it('filters the list via search', () => {
    render(<CurrencyPicker value="EUR" currencies={CURRENCIES} onChange={jest.fn()} />)
    fireEvent.press(screen.getByRole('button'))
    fireEvent.changeText(screen.getByPlaceholderText('Search currency'), 'gb')
    expect(screen.getByRole('radio', { name: 'GBP' })).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'USD' })).toBeNull()
  })
})
