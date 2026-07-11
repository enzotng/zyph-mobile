import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import type { CategoryTotal } from '@/features/expenses'

import { CategoryDonut } from './category-donut'

const segments: CategoryTotal[] = [
  { category: 'food', cents: 60000 },
  { category: 'transport', cents: 40000 },
]

describe('CategoryDonut', () => {
  it('renders the centre children', () => {
    render(
      <CategoryDonut segments={segments}>
        <Text>1 000,00 EUR</Text>
      </CategoryDonut>,
    )

    expect(screen.getByText('1 000,00 EUR')).toBeOnTheScreen()
  })

  it('renders without crashing when segments is empty', () => {
    render(
      <CategoryDonut segments={[]}>
        <Text>0,00 EUR</Text>
      </CategoryDonut>,
    )

    expect(screen.getByText('0,00 EUR')).toBeOnTheScreen()
  })

  it('renders without crashing when the total is zero', () => {
    const zeroTotal: CategoryTotal[] = [
      { category: 'food', cents: 0 },
      { category: null, cents: 0 },
    ]

    render(
      <CategoryDonut segments={zeroTotal}>
        <Text>0,00 EUR</Text>
      </CategoryDonut>,
    )

    expect(screen.getByText('0,00 EUR')).toBeOnTheScreen()
  })

  it('renders with default size/strokeWidth and no children', () => {
    expect(() => render(<CategoryDonut segments={segments} />)).not.toThrow()
  })
})
