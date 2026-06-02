import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { Card } from './card'

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <Text>Hello card</Text>
      </Card>,
    )

    expect(screen.getByText('Hello card')).toBeOnTheScreen()
  })

  it('renders as a plain View (no button role) when no onPress is provided', () => {
    render(
      <Card>
        <Text>Static</Text>
      </Card>,
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders as a button when onPress is provided', () => {
    render(
      <Card onPress={jest.fn()}>
        <Text>Tappable</Text>
      </Card>,
    )

    expect(screen.getByRole('button')).toBeOnTheScreen()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    render(
      <Card onPress={onPress}>
        <Text>Press me</Text>
      </Card>,
    )

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('accepts custom padding and style without throwing', () => {
    expect(() =>
      render(
        <Card padding={8} style={{ opacity: 0.5 }}>
          <Text>Padded</Text>
        </Card>,
      ),
    ).not.toThrow()
  })
})
