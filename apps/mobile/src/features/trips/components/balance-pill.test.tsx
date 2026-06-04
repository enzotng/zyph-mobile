import { render, screen } from '@testing-library/react-native'

import { BalancePill } from './balance-pill'

// Render Ionicons as a Text node carrying its icon name so each sign-driven
// branch of the trend icon can be asserted from the rendered tree.
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text: MockText } = require('react-native')
  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(MockText, null, `icon:${name}`),
  }
})

describe('BalancePill', () => {
  it('shows a signed positive amount and the trending-up icon when cents > 0', () => {
    render(<BalancePill cents={1200} currency="EUR" />)

    expect(screen.getByText('+12.00 EUR')).toBeOnTheScreen()
    expect(screen.getByText('icon:trending-up')).toBeOnTheScreen()
  })

  it('shows a negative amount and the trending-down icon when cents < 0', () => {
    render(<BalancePill cents={-850} currency="EUR" />)

    expect(screen.getByText('-8.50 EUR')).toBeOnTheScreen()
    expect(screen.getByText('icon:trending-down')).toBeOnTheScreen()
  })

  it('shows a zero amount and the remove icon when cents === 0', () => {
    render(<BalancePill cents={0} currency="EUR" />)

    expect(screen.getByText('0.00 EUR')).toBeOnTheScreen()
    expect(screen.getByText('icon:remove')).toBeOnTheScreen()
  })

  it('renders the provided currency code', () => {
    render(<BalancePill cents={500} currency="USD" />)

    expect(screen.getByText('+5.00 USD')).toBeOnTheScreen()
  })
})
