import { fireEvent, render, screen } from '@testing-library/react-native'

import { Button } from './button'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button label="Get started" />)

    expect(screen.getByText('Get started')).toBeOnTheScreen()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    render(<Button label="Continue" onPress={onPress} />)

    fireEvent.press(screen.getByText('Continue'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
