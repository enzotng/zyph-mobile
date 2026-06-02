import { render, screen } from '@testing-library/react-native'

import { Amount } from './amount'

describe('Amount', () => {
  it('renders a positive amount without sign by default', () => {
    render(<Amount cents={1500} />)

    expect(screen.getByText('15.00 EUR')).toBeOnTheScreen()
  })

  it('renders a negative amount without sign by default', () => {
    render(<Amount cents={-800} />)

    expect(screen.getByText('-8.00 EUR')).toBeOnTheScreen()
  })

  it('renders a signed positive amount starting with "+"', () => {
    render(<Amount cents={1200} signed />)

    const el = screen.getByText(/^\+/)
    expect(el).toBeOnTheScreen()
  })

  it('renders a signed negative amount with "-"', () => {
    render(<Amount cents={-850} signed />)

    expect(screen.getByText('-8.50 EUR')).toBeOnTheScreen()
  })

  it('renders the value in neutral mode without throwing', () => {
    expect(() => render(<Amount cents={500} neutral />)).not.toThrow()
    expect(screen.getByText('5.00 EUR')).toBeOnTheScreen()
  })

  it('renders zero without throwing', () => {
    expect(() => render(<Amount cents={0} />)).not.toThrow()
    expect(screen.getByText('0.00 EUR')).toBeOnTheScreen()
  })

  it('accepts a custom currency and size', () => {
    expect(() => render(<Amount cents={300} currency="USD" size={20} />)).not.toThrow()
    expect(screen.getByText('3.00 USD')).toBeOnTheScreen()
  })
})
